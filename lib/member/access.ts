import { getServerSupabase } from '@/lib/supabase/server';
import type { MemberContext } from '@/lib/member/auth';

export async function getMemberSnapshot(userId: string) {
  const db = getServerSupabase();
  const [{ data: profile }, { data: subscription }, { data: wallet }, { data: suspension }] = await Promise.all([
    db.from('profiles').select('*').eq('user_id', userId).single(),
    db.from('member_subscriptions').select('*,member_plans(*)').eq('user_id', userId).single(),
    db.from('credit_wallets').select('*').eq('user_id', userId).single(),
    db.from('suspensions').select('*').eq('user_id', userId).eq('status', 'active').maybeSingle(),
  ]);
  return { profile, subscription, wallet, suspension };
}

export async function requireActiveMember(member: MemberContext) {
  const snapshot = await getMemberSnapshot(member.userId);
  if (snapshot.profile?.deletion_requested_at) throw new Error('ACCOUNT_DELETION_PENDING');
  if (snapshot.suspension) throw new Error('ACCOUNT_SUSPENDED');
  return snapshot;
}

export async function reserveForAI(userId: string, requestId: string, amount = 1) {
  const db = getServerSupabase();
  const { data, error } = await db.rpc('reserve_member_credits', { p_user_id: userId, p_request_id: requestId, p_amount: amount });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function settleAI(userId: string, requestId: string, actualCredits: number) {
  const db = getServerSupabase();
  const { data, error } = await db.rpc('settle_member_credits', { p_user_id: userId, p_request_id: requestId, p_actual: Math.max(0, actualCredits) });
  if (error) throw new Error(error.message);
  return data;
}

export async function releaseAI(userId: string, requestId: string) {
  const db = getServerSupabase();
  await db.rpc('release_member_credits', { p_user_id: userId, p_request_id: requestId });
}
