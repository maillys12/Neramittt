import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { readDeviceToken } from '@/lib/http/device';
import { resolveDevice } from '@/lib/device/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { getOpenAI } from '@/lib/openai/client';
import { normalizeCreationSettings, settingsPatch } from '@/lib/ui/creation-settings';
import { buildLegacyChatInstructions } from '@/lib/ui/chat-instructions';
import { buildPromptRepairInstructions, hasFencedPromptBlocks, sanitizeModelText, validateFinalPromptResponse } from '@/lib/ui/image-prompt-policy';
import { AssistantTurnSchema, ChatRequestSchema, CreationSettingsSchema, type ChatStreamEvent } from '@/lib/chat/contracts';
import { encodeChatEvent } from '@/lib/chat/ndjson';
import { runResearchChat } from '@/lib/chat/orchestrator';
import { getBudgetGuardForStage } from '@/lib/ai/runtime';
import { getAIRuntimeConfig } from '@/lib/ai/config';
import { resolveModelForStage, isEligibleFallbackError } from '@/lib/ai/model-router';
import { recordAIUsage } from '@/lib/ai/usage';
import { getPublishedPrompt } from '@/lib/ai/prompts';
import type { AIStage } from '@/lib/ai/types';
import type { PublishedPromptOverrides } from '@/lib/ui/chat-instructions';
import { assistantTurnContent, assistantTurnMetadata, serializeChatError } from '@/lib/chat/persistence';

export const maxDuration = 120;

const LegacySchema = z.object({
  draftId: z.string().uuid(),
  message: z.string().min(1).max(5000),
  settings: CreationSettingsSchema.optional(),
});
const CHAT_CONTEXT_LIMIT = 12;

function objectBrief(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function loadPublishedOverrides(): Promise<PublishedPromptOverrides> {
  try {
    const runtime = await getAIRuntimeConfig();
    if (runtime.safeMode) return {};
    const [system, creative] = await Promise.all([
      getPublishedPrompt('system'),
      getPublishedPrompt('creative_director'),
    ]);
    return { system: system?.content, creativeDirector: creative?.content };
  } catch {
    return {};
  }
}

async function callConfiguredResponse(input: {
  stage: AIStage;
  requestId: string;
  maxOutputTokens: number;
  instructions: string;
  promptInput: string;
}) {
  const guard = await getBudgetGuardForStage(input.stage);
  const route = resolveModelForStage({ stage: input.stage, runtime: guard.runtime, budgetPolicy: guard.routingPolicy });
  const ai = getOpenAI();

  const run = async (model: string, retryIndex = 0) => {
    const startedAtMs = Date.now();
    try {
      const response = await ai.responses.create({
        model,
        reasoning: { effort: route.reasoningEffort as any },
        store: false,
        max_output_tokens: Math.min(input.maxOutputTokens, route.maxOutputTokens),
        instructions: input.instructions,
        input: input.promptInput,
      });
      await recordAIUsage({
        requestId: input.requestId,
        executionMode: 'production',
        stage: input.stage,
        model,
        startedAtMs,
        response,
        status: 'success',
        retryIndex,
      });
      return response;
    } catch (error) {
      await recordAIUsage({
        requestId: input.requestId,
        executionMode: 'production',
        stage: input.stage,
        model,
        startedAtMs,
        status: 'error',
        errorCode: error instanceof Error ? error.message : 'CHAT_FAILED',
        retryIndex,
      });
      throw error;
    }
  };

  try {
    return await run(route.model);
  } catch (error) {
    if (!isEligibleFallbackError(error) || route.fallbackModel === route.model) throw error;
    return run(route.fallbackModel, 1);
  }
}

async function legacyPost(req: Request) {
  try {
    const device = await resolveDevice(readDeviceToken(req));
    const input = LegacySchema.parse(await req.json());
    const db = getServerSupabase();
    const { data: draft, error } = await db.from('drafts').select('id,brief').eq('id', input.draftId).eq('device_id', device.id).single();
    if (error) throw error;
    const prior = objectBrief(draft.brief);
    const settings = input.settings ?? normalizeCreationSettings(prior);
    const briefWithSettings = { ...prior, ...settingsPatch(settings) };
    const { error: insertError } = await db.from('chat_messages').insert({ draft_id: draft.id, role: 'user', content: input.message });
    if (insertError) throw insertError;
    const { data: messages, error: messageError } = await db.from('chat_messages').select('role,content').eq('draft_id', draft.id).order('created_at', { ascending: false }).limit(CHAT_CONTEXT_LIMIT);
    if (messageError) throw messageError;
    const chronological = [...(messages ?? [])].reverse();
    const maxOutputTokens = settings.variantCount === 3 ? 1800 : settings.variantCount === 2 ? 1400 : 1000;
    const requestId = randomUUID();
    const overrides = await loadPublishedOverrides();
    const ai = await callConfiguredResponse({
      stage: 'requirement',
      requestId,
      maxOutputTokens,
      instructions: buildLegacyChatInstructions(settings, overrides),
      promptInput: chronological.map(message => `${message.role}: ${message.content}`).join('\n'),
    });
    let text = sanitizeModelText(ai.output_text || (settings.language === 'en' ? 'Please share a little more detail.' : 'เล่ารายละเอียดเพิ่มอีกเล็กน้อยได้เลยครับ'));
    const looksLikeFinal = hasFencedPromptBlocks(text) || text.includes('Subject & Medium:') || text.includes('หัวข้อและสื่อ:');
    if (looksLikeFinal) {
      let validation = validateFinalPromptResponse(text, settings.variantCount, settings.language, settings.platform);
      if (!validation.ok) {
        const repaired = await callConfiguredResponse({
          stage: 'repair',
          requestId,
          maxOutputTokens,
          instructions: buildPromptRepairInstructions(settings.variantCount, settings.language, settings.platform),
          promptInput: `Repair this response without changing the user's intended visual requirements:\n\n${text}`,
        });
        text = sanitizeModelText(repaired.output_text || '');
        validation = validateFinalPromptResponse(text, settings.variantCount, settings.language, settings.platform);
        if (!validation.ok) throw new Error('PROMPT_FORMAT_FAILED');
      }
    }
    const nextBrief = { ...briefWithSettings, conversation_summary: text };
    const [assistantWrite, draftWrite] = await Promise.all([
      db.from('chat_messages').insert({ draft_id: draft.id, role: 'assistant', content: text }),
      db.from('drafts').update({ brief: nextBrief, updated_at: new Date().toISOString() }).eq('id', draft.id).eq('device_id', device.id),
    ]);
    if (assistantWrite.error) throw assistantWrite.error;
    if (draftWrite.error) throw draftWrite.error;
    return NextResponse.json({ ok: true, message: text, brief: nextBrief, settings });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'CHAT_FAILED' }, { status: 400 });
  }
}

async function structuredPost(req: Request) {
  let language: 'th' | 'en' = 'th';
  try {
    const device = await resolveDevice(readDeviceToken(req));
    const input = ChatRequestSchema.parse(await req.json());
    const db = getServerSupabase();
    const { data: draft, error } = await db.from('drafts').select('id,brief').eq('id', input.draftId).eq('device_id', device.id).single();
    if (error) throw error;
    const prior = objectBrief(draft.brief);
    const settings = input.settings ?? normalizeCreationSettings(prior);
    language = settings.language;
    const briefWithSettings = { ...prior, ...settingsPatch(settings) };

    const { data: existing } = await db.from('chat_messages')
      .select('metadata')
      .eq('draft_id', draft.id)
      .eq('role', 'assistant')
      .eq('metadata->>requestId', input.requestId)
      .maybeSingle();
    const existingMetadata = objectBrief(existing?.metadata);
    const existingTurn = AssistantTurnSchema.safeParse(existingMetadata.turn);

    if (!existingTurn.success) {
      const userMetadata = input.selection ? { version: 2, parentRequestId: input.requestId, selection: input.selection } : { version: 2, parentRequestId: input.requestId };
      const { error: insertError } = await db.from('chat_messages').insert({
        draft_id: draft.id,
        role: 'user',
        content: input.message,
        metadata: userMetadata,
      });
      if (insertError) throw insertError;
    }

    const { data: messages, error: messageError } = await db.from('chat_messages')
      .select('role,content')
      .eq('draft_id', draft.id)
      .order('created_at', { ascending: false })
      .limit(CHAT_CONTEXT_LIMIT);
    if (messageError) throw messageError;
    const history = [...(messages ?? [])].reverse().map(message => ({
      role: message.role === 'assistant' ? 'assistant' as const : 'user' as const,
      content: String(message.content ?? ''),
    }));
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: ChatStreamEvent) => controller.enqueue(encoder.encode(encodeChatEvent(event)));
        try {
          if (existingTurn.success) {
            send({ type: 'turn', turn: existingTurn.data });
            send({ type: 'done', requestId: input.requestId });
            return;
          }

          const selectedContext = input.selection ? `${input.message}\n[Selected value: ${input.selection.value}]` : input.message;
          const turn = await runResearchChat({
            message: selectedContext,
            history,
            settings,
            assets: input.assets ?? [],
            requestId: input.requestId,
            executionMode: 'production',
          }, stage => { send({ type: 'stage', stage }); });
          const content = assistantTurnContent(turn);
          const nextBrief = {
            ...briefWithSettings,
            ...turn.briefPatch,
            conversation_summary: content,
            research_snapshot: turn.type === 'final' ? { sources: turn.sources, researched_at: new Date().toISOString() } : prior.research_snapshot,
          };
          const [assistantWrite, draftWrite] = await Promise.all([
            db.from('chat_messages').insert({
              draft_id: draft.id,
              role: 'assistant',
              content,
              metadata: assistantTurnMetadata(turn, input.requestId),
            }),
            db.from('drafts').update({ brief: nextBrief, updated_at: new Date().toISOString() }).eq('id', draft.id).eq('device_id', device.id),
          ]);
          if (assistantWrite.error) throw assistantWrite.error;
          if (draftWrite.error) throw draftWrite.error;
          send({ type: 'turn', turn });
          send({ type: 'done', requestId: input.requestId });
        } catch (error) {
          send(serializeChatError(error, settings.language));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'content-type': 'application/x-ndjson; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        'x-accel-buffering': 'no',
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: serializeChatError(error, language) }, { status: 400 });
  }
}

export async function POST(req: Request) {
  if (process.env.NERAMIT_RESEARCH_CHAT_V2 !== 'true') return legacyPost(req);
  return structuredPost(req);
}
