import { getServerSupabase } from '@/lib/supabase/server';

export async function createAdminNotification(input: {
  severity: 'info' | 'warning' | 'critical';
  source: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  dedupeKey?: string;
}) {
  const db = getServerSupabase();
  if (input.dedupeKey) {
    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    const { data } = await db.from('admin_notifications')
      .select('id')
      .eq('metadata->>dedupeKey', input.dedupeKey)
      .gte('created_at', since)
      .limit(1);
    if ((data ?? []).length) return;
  }
  const metadata = { ...(input.metadata ?? {}), ...(input.dedupeKey ? { dedupeKey: input.dedupeKey } : {}) };
  const { error } = await db.from('admin_notifications').insert({
    severity: input.severity,
    source: input.source,
    title: input.title,
    message: input.message,
    metadata,
  });
  if (error) throw error;
}
