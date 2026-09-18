import { zodTextFormat } from 'openai/helpers/zod';
import { getOpenAI } from '@/lib/openai/client';
import { buildChatInstructions, type PublishedPromptOverrides } from '@/lib/ui/chat-instructions';
import { AssistantTurnSchema, type AssistantTurn, type SourceRef } from '@/lib/chat/contracts';
import type { CreationSettings } from '@/lib/ui/creation-settings';
import type { AIExecutionMode } from '@/lib/ai/types';
import { getBudgetGuardForStage } from '@/lib/ai/runtime';
import { resolveModelForStage, isEligibleFallbackError } from '@/lib/ai/model-router';
import { recordAIUsage } from '@/lib/ai/usage';
import { getPublishedPrompt } from '@/lib/ai/prompts';

export type ResearchGenerationInput = {
  message: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  settings: CreationSettings;
  assets: Array<{ id: string; kind: 'logo' | 'reference'; authentic: boolean; label?: string }>;
  officialContext: boolean;
  requestId: string;
  executionMode: AIExecutionMode;
  repairReasons?: string[];
  promptOverrides?: PublishedPromptOverrides;
};

type CitationResponse = {
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      annotations?: Array<{ type?: string; title?: string; url?: string }>;
    }>;
  }>;
};

function sourceTypeForDomain(domain: string): SourceRef['sourceType'] {
  if (/\.(?:go|ac)\.th$|\.gov$|\.edu$/i.test(domain)) return 'official';
  return 'primary';
}

export function normalizeSources(response: CitationResponse) {
  const sources = new Map<string, SourceRef>();
  for (const item of response.output ?? []) {
    if (item.type !== 'message') continue;
    for (const part of item.content ?? []) {
      for (const annotation of part.annotations ?? []) {
        if (annotation.type !== 'url_citation' || !annotation.url) continue;
        try {
          const url = new URL(annotation.url);
          const canonical = `${url.origin}${url.pathname}`.replace(/\/$/, '') || url.origin;
          sources.set(canonical, {
            title: annotation.title?.trim() || url.hostname,
            url: annotation.url,
            domain: url.hostname,
            sourceType: sourceTypeForDomain(url.hostname),
          });
        } catch {
          // Invalid model citations are discarded rather than shown to users.
        }
      }
    }
  }
  return [...sources.values()].slice(0, 20);
}

async function publishedOverrides(): Promise<PublishedPromptOverrides> {
  try {
    const [system, creative] = await Promise.all([
      getPublishedPrompt('system'),
      getPublishedPrompt('creative_director'),
    ]);
    return { system: system?.content, creativeDirector: creative?.content };
  } catch {
    return {};
  }
}

export async function generateResearchTurn(input: ResearchGenerationInput): Promise<AssistantTurn> {
  const ai = getOpenAI();

  const researchGuard = await getBudgetGuardForStage('research');
  const researchRoute = resolveModelForStage({ stage: 'research', runtime: researchGuard.runtime, budgetPolicy: researchGuard.routingPolicy });
  const researchStarted = Date.now();
  let research: Awaited<ReturnType<typeof ai.responses.create>>;
  try {
    research = await ai.responses.create({
      model: researchRoute.model,
      reasoning: { effort: researchRoute.reasoningEffort as any },
      store: false,
      max_output_tokens: researchRoute.maxOutputTokens,
      tools: [{ type: 'web_search', search_context_size: 'medium' }],
      instructions: [
        'Research the user request before any creative recommendation.',
        'Use at least one web search. Prefer official and primary sources, especially for named organizations.',
        'Verify official names, identity guidance, terminology, and current facts. For fact-free work, research relevant current design and domain conventions.',
        'Research the communication conventions of the job type so the result functions as a real poster, announcement, campaign, sign, cover, or advertisement rather than a generic decorative image.',
        'Return a concise evidence summary. Do not invent missing facts and do not copy long passages.',
      ].join('\n'),
      input: input.message,
    });
    await recordAIUsage({ requestId: input.requestId, executionMode: input.executionMode, stage: 'research', model: researchRoute.model, startedAtMs: researchStarted, response: research, status: 'success' });
  } catch (error) {
    await recordAIUsage({ requestId: input.requestId, executionMode: input.executionMode, stage: 'research', model: researchRoute.model, startedAtMs: researchStarted, status: 'error', errorCode: error instanceof Error ? error.message : 'RESEARCH_FAILED' });
    if (!isEligibleFallbackError(error) || researchRoute.fallbackModel === researchRoute.model) throw error;
    const retryStarted = Date.now();
    try {
      research = await ai.responses.create({
        model: researchRoute.fallbackModel,
        reasoning: { effort: researchRoute.reasoningEffort as any },
        store: false,
        max_output_tokens: researchRoute.maxOutputTokens,
        tools: [{ type: 'web_search', search_context_size: 'medium' }],
        instructions: 'Research the request using web search. Prefer official and primary sources. Return a concise factual evidence summary without inventing missing facts.',
        input: input.message,
      });
      await recordAIUsage({ requestId: input.requestId, executionMode: input.executionMode, stage: 'research', model: researchRoute.fallbackModel, startedAtMs: retryStarted, response: research, status: 'success', retryIndex: 1 });
    } catch (retryError) {
      await recordAIUsage({ requestId: input.requestId, executionMode: input.executionMode, stage: 'research', model: researchRoute.fallbackModel, startedAtMs: retryStarted, status: 'error', errorCode: retryError instanceof Error ? retryError.message : 'RESEARCH_FAILED', retryIndex: 1 });
      throw retryError;
    }
  }

  const researchText = research.output_text?.trim();
  if (!researchText) throw new Error('RESEARCH_FAILED');
  const sources = normalizeSources(research);

  const generationGuard = await getBudgetGuardForStage('creative_director');
  const generationRoute = resolveModelForStage({ stage: 'creative_director', runtime: generationGuard.runtime, budgetPolicy: generationGuard.routingPolicy });
  const overrides = input.promptOverrides ?? await publishedOverrides();
  const generationStarted = Date.now();

  const runGeneration = async (model: string, retryIndex = 0) => {
    const startedAtMs = retryIndex ? Date.now() : generationStarted;
    try {
      const generation = await ai.responses.parse({
        model,
        reasoning: { effort: generationRoute.reasoningEffort as any },
        store: false,
        max_output_tokens: Math.max(
          generationRoute.maxOutputTokens,
          input.settings.variantCount === 3 ? 2600 : input.settings.variantCount === 2 ? 2100 : 1700,
        ),
        instructions: buildChatInstructions(input.settings, overrides),
        input: JSON.stringify({
          userMessage: input.message,
          recentConversation: input.history.slice(-12),
          researchFindings: researchText,
          verifiedSources: sources,
          suppliedAssets: input.assets,
          officialContext: input.officialContext,
          repairReasons: input.repairReasons ?? [],
        }),
        text: { format: zodTextFormat(AssistantTurnSchema, 'assistant_turn') },
      });
      await recordAIUsage({ requestId: input.requestId, executionMode: input.executionMode, stage: 'creative_director', model, startedAtMs, response: generation, status: 'success', retryIndex });
      return generation;
    } catch (error) {
      await recordAIUsage({ requestId: input.requestId, executionMode: input.executionMode, stage: 'creative_director', model, startedAtMs, status: 'error', errorCode: error instanceof Error ? error.message : 'PROMPT_FORMAT_FAILED', retryIndex });
      throw error;
    }
  };

  let generation;
  try {
    generation = await runGeneration(generationRoute.model);
  } catch (error) {
    if (!isEligibleFallbackError(error) || generationRoute.fallbackModel === generationRoute.model) throw error;
    generation = await runGeneration(generationRoute.fallbackModel, 1);
  }

  if (!generation.output_parsed) throw new Error('PROMPT_FORMAT_FAILED');
  const turn = AssistantTurnSchema.parse(generation.output_parsed);
  return turn.type === 'final' ? { ...turn, sources } : turn;
}
