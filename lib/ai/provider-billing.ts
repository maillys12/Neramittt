export type ProviderBillingSnapshot =
  | { available: true; source: 'openai'; asOf: string; costUsd?: number; creditBalanceUsd?: number; note?: string }
  | { available: false; source: 'openai'; asOf: string; reason: 'unsupported' | 'unauthorized' | 'unconfigured' | 'error' };

export async function getProviderBillingSnapshot(): Promise<ProviderBillingSnapshot> {
  const asOf = new Date().toISOString();
  const adminKey = process.env.OPENAI_ADMIN_API_KEY;
  if (!adminKey) return { available: false, source: 'openai', asOf, reason: 'unconfigured' };

  try {
    const start = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
    const response = await fetch(`https://api.openai.com/v1/organization/costs?start_time=${start}&limit=31`, {
      headers: { Authorization: `Bearer ${adminKey}` },
      cache: 'no-store',
    });
    if (response.status === 401 || response.status === 403) return { available: false, source: 'openai', asOf, reason: 'unauthorized' };
    if (!response.ok) return { available: false, source: 'openai', asOf, reason: 'error' };
    const body = await response.json() as { data?: Array<{ results?: Array<{ amount?: { value?: number } }> }> };
    const costUsd = (body.data ?? []).flatMap(bucket => bucket.results ?? []).reduce((sum, item) => sum + Number(item.amount?.value ?? 0), 0);
    return { available: true, source: 'openai', asOf, costUsd, note: 'Provider-reported organization cost. Credit balance is omitted unless OpenAI exposes it through a reliable API.' };
  } catch {
    return { available: false, source: 'openai', asOf, reason: 'error' };
  }
}
