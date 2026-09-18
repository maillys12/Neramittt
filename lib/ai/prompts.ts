import { getServerSupabase } from '@/lib/supabase/server';
import { writeAdminAudit } from '@/lib/admin/audit';
import type { PromptType, PromptVersion } from '@/lib/ai/types';

function mapPrompt(row: Record<string, unknown>): PromptVersion {
  return {
    id: String(row.id),
    promptType: row.prompt_type as PromptType,
    version: Number(row.version),
    status: row.status as PromptVersion['status'],
    content: String(row.content ?? ''),
    changeNote: row.change_note == null ? null : String(row.change_note),
    createdAt: String(row.created_at),
    publishedAt: row.published_at == null ? null : String(row.published_at),
  };
}

async function getByStatus(promptType: PromptType, status: 'draft'|'published') {
  const db = getServerSupabase();
  const { data, error } = await db.from('ai_prompt_versions')
    .select('*').eq('prompt_type', promptType).eq('status', status)
    .order('version', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data ? mapPrompt(data as Record<string, unknown>) : null;
}

export const getPublishedPrompt = (promptType: PromptType) => getByStatus(promptType, 'published');
export const getDraftPrompt = (promptType: PromptType) => getByStatus(promptType, 'draft');

export async function listPromptVersions(promptType: PromptType, limit = 30) {
  const db = getServerSupabase();
  const { data, error } = await db.from('ai_prompt_versions').select('*')
    .eq('prompt_type', promptType).order('version', { ascending: false }).limit(Math.min(100, Math.max(1, limit)));
  if (error) throw error;
  return (data ?? []).map(row => mapPrompt(row as Record<string, unknown>));
}

export async function savePromptDraft(input: { promptType: PromptType; content: string; changeNote?: string }) {
  const db = getServerSupabase();
  const clean = input.content.trim();
  if (!clean || clean.length > 50_000) throw new Error('PROMPT_CONTENT_INVALID');
  const { data: latest, error: latestError } = await db.from('ai_prompt_versions')
    .select('version').eq('prompt_type', input.promptType).order('version', { ascending: false }).limit(1).maybeSingle();
  if (latestError) throw latestError;
  const version = Number(latest?.version ?? 0) + 1;
  await db.from('ai_prompt_versions').update({ status: 'archived' })
    .eq('prompt_type', input.promptType).eq('status', 'draft');
  const { data, error } = await db.from('ai_prompt_versions').insert({
    prompt_type: input.promptType,
    version,
    status: 'draft',
    content: clean,
    change_note: input.changeNote?.trim() || null,
  }).select('*').single();
  if (error) throw error;
  const result = mapPrompt(data as Record<string, unknown>);
  await writeAdminAudit({ action: 'ai_prompt_draft_saved', subjectType: input.promptType, subjectId: result.id, newValue: { version } });
  return result;
}

export async function publishPrompt(input: { promptType: PromptType; draftId: string }) {
  const before = await getPublishedPrompt(input.promptType);
  const db = getServerSupabase();
  const { data, error } = await db.rpc('publish_ai_prompt', { p_prompt_type: input.promptType, p_draft_id: input.draftId });
  if (error) throw error;
  const after = await getPublishedPrompt(input.promptType);
  await writeAdminAudit({
    action: 'ai_prompt_published',
    subjectType: input.promptType,
    subjectId: String(data ?? input.draftId),
    previousValue: before ? { id: before.id, version: before.version } : null,
    newValue: after ? { id: after.id, version: after.version } : null,
  });
  if (!after) throw new Error('PROMPT_PUBLISH_FAILED');
  return after;
}

export async function rollbackPrompt(input: { promptType: PromptType; version: number }) {
  const before = await getPublishedPrompt(input.promptType);
  const db = getServerSupabase();
  const { error } = await db.rpc('rollback_ai_prompt', { p_prompt_type: input.promptType, p_version: input.version });
  if (error) throw error;
  const after = await getPublishedPrompt(input.promptType);
  await writeAdminAudit({
    action: 'ai_prompt_rollback',
    subjectType: input.promptType,
    subjectId: String(input.version),
    previousValue: before ? { id: before.id, version: before.version } : null,
    newValue: after ? { id: after.id, version: after.version } : null,
  });
  if (!after) throw new Error('PROMPT_ROLLBACK_FAILED');
  return after;
}
