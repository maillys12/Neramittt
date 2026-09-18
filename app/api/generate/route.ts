import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readDeviceToken } from '@/lib/http/device';
import { resolveDevice } from '@/lib/device/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { getOpenAI } from '@/lib/openai/client';
import { selectedReferenceAnalysis } from '@/lib/references/selected';
import { buildGenerationInstructions } from '@/lib/generate/instructions';
import { parseGenerationResult } from '@/lib/generate/result';
import { normalizeCreationSettings } from '@/lib/ui/creation-settings';
import { sanitizeModelText } from '@/lib/ui/image-prompt-policy';

export const maxDuration = 120;

const RequestSchema = z.object({
  draftId: z.string().uuid(),
  requestId: z.string().min(8).max(120),
  variantCount: z.number().int().min(1).max(3).default(1),
});

export async function POST(req: Request) {
  let requestId = '';
  let deviceId = '';
  const db = getServerSupabase();

  try {
    const device = await resolveDevice(readDeviceToken(req));
    deviceId = device.id;
    const input = RequestSchema.parse(await req.json());
    requestId = input.requestId;

    const { data: draft, error } = await db
      .from('drafts')
      .select('*')
      .eq('id', input.draftId)
      .eq('device_id', device.id)
      .single();
    if (error) throw error;

    const settings = normalizeCreationSettings(
      draft.brief && typeof draft.brief === 'object' ? draft.brief : {},
    );
    const variantCount = input.variantCount || settings.variantCount;
    const [refsQuery, settingQuery] = await Promise.all([
      db.from('reference_images').select('analysis,usage_options').eq('draft_id', draft.id).eq('device_id', device.id),
      db.from('settings').select('value').eq('key', 'daily_quota').single(),
    ]);
    if (refsQuery.error) throw refsQuery.error;
    const selected = selectedReferenceAnalysis(refsQuery.data ?? []);

    const { data: reserved, error: reserveError } = await db.rpc('reserve_prompt_quota', {
      p_device_id: device.id,
      p_draft_id: draft.id,
      p_request_id: input.requestId,
      p_variant_count: variantCount,
      p_daily_limit: Number(settingQuery.data?.value ?? 10),
    });
    if (reserveError) throw reserveError;

    const row = reserved?.[0];
    if (row?.is_existing) {
      const { data: job } = await db
        .from('prompt_jobs')
        .select('*')
        .eq('request_id', input.requestId)
        .eq('device_id', device.id)
        .single();
      return NextResponse.json({ ok: true, job });
    }
    if (!row?.job_id) throw new Error('QUOTA_RESERVATION_FAILED');

    await db.from('prompt_jobs').update({ status: 'processing' }).eq('id', row.job_id).eq('device_id', device.id);

    const ai = getOpenAI();
    const model = process.env.NERAMIT_RESEARCH_MODEL || 'gpt-5.6-luna';
    const research = await ai.responses.create({
      model,
      reasoning: { effort: 'low' },
      store: false,
      max_output_tokens: 1200,
      tools: [{ type: 'web_search', search_context_size: 'medium' }],
      instructions: [
        'Research this creative brief before writing any image prompt.',
        'Use at least one web search and prefer official or primary sources for named institutions, brands, events, people, dates, identity, and requirements.',
        'Also research current communication and design conventions for the job type.',
        'Separate verified facts from creative recommendations and never invent missing official information.',
      ].join('\n'),
      input: JSON.stringify({ brief: draft.brief, selectedReferenceAnalysis: selected }),
    });
    if (!research.output_text?.trim()) throw new Error('RESEARCH_FAILED');

    const generation = await ai.responses.create({
      model,
      reasoning: { effort: 'low' },
      store: false,
      max_output_tokens: variantCount === 3 ? 3000 : variantCount === 2 ? 2500 : 2000,
      instructions: buildGenerationInstructions(settings, variantCount),
      input: JSON.stringify({
        brief: draft.brief,
        selectedReferenceAnalysis: selected,
        researchFindings: research.output_text,
      }),
    });

    const result = parseGenerationResult(sanitizeModelText(generation.output_text), variantCount);
    const completedAt = new Date().toISOString();
    const [jobWrite, promptWrite] = await Promise.all([
      db.from('prompt_jobs').update({ status: 'completed', result, completed_at: completedAt }).eq('id', row.job_id).eq('device_id', device.id),
      db.from('prompts').insert({
        device_id: device.id,
        draft_id: draft.id,
        prompt_job_id: row.job_id,
        title: draft.title,
        variants: result.variants,
        input_summary: {
          ...draft.brief,
          target_platform: settings.platform,
          prompt_language: settings.language,
          variant_count: variantCount,
        },
      }),
    ]);
    if (jobWrite.error) throw jobWrite.error;
    if (promptWrite.error) throw promptWrite.error;

    await db.rpc('finalize_prompt_quota', { p_request_id: input.requestId, p_success: true });
    return NextResponse.json({ ok: true, result, settings: { ...settings, variantCount } });
  } catch (error) {
    if (requestId && deviceId) {
      await Promise.all([
        db.from('prompt_jobs').update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'GENERATE_FAILED',
          completed_at: new Date().toISOString(),
        }).eq('request_id', requestId).eq('device_id', deviceId),
        db.rpc('finalize_prompt_quota', { p_request_id: requestId, p_success: false }),
      ]);
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'GENERATE_FAILED' }, { status: 400 });
  }
}
