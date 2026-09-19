import { createClient } from '@supabase/supabase-js';

export type MemberContext = {
  userId: string;
  email: string | null;
  accessToken: string;
};

export function getBearerToken(req: Request) {
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) throw new Error('MEMBER_REQUIRED');
  const token = header.slice(7).trim();
  if (!token) throw new Error('MEMBER_REQUIRED');
  return token;
}

function getPublishableConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Supabase member configuration is missing');
  return { url, key };
}

export async function requireMember(req: Request): Promise<MemberContext> {
  const accessToken = getBearerToken(req);
  const { url, key } = getPublishableConfig();
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) throw new Error('MEMBER_SESSION_EXPIRED');
  return { userId: data.user.id, email: data.user.email ?? null, accessToken };
}

export function getMemberScopedClient(accessToken: string) {
  const { url, key } = getPublishableConfig();
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
