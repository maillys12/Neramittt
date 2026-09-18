import { getServerSupabase } from '@/lib/supabase/server';

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (/key|secret|password|token|credential/i.test(key)) out[key] = '[redacted]';
    else out[key] = sanitize(val);
  }
  return out;
}

export async function writeAdminAudit(input: {
  action: string;
  subjectType?: string;
  subjectId?: string;
  previousValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown>;
}) {
  const db = getServerSupabase();
  const metadata = sanitize({
    previousValue: input.previousValue,
    newValue: input.newValue,
    ...(input.metadata ?? {}),
  }) as Record<string, unknown>;
  const { error } = await db.from('admin_audit_logs').insert({
    action: input.action,
    target_type: input.subjectType ?? null,
    target_id: input.subjectId ?? null,
    metadata,
  });
  if (error) throw error;
}
