import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

function authorized(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const actual = req.headers.get('authorization')?.replace(/^Bearer\s+/, '') ?? '';
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ ok: false }, { status: 401 });

  const db = getServerSupabase();
  const now = new Date();
  const nowIso = now.toISOString();

  const { data: refs } = await db.from('reference_images').select('id,storage_path').lt('expires_at', nowIso).limit(200);
  if (refs?.length) {
    await db.storage.from('reference-images').remove(refs.map(row => row.storage_path));
    await db.from('reference_images').delete().in('id', refs.map(row => row.id));
  }
  await db.from('drafts').delete().lt('expires_at', nowIso);
  await db.from('admin_sessions').delete().lt('expires_at', nowIso);
  await db.from('admin_login_attempts').delete().lt('created_at', new Date(Date.now() - 86_400_000).toISOString());

  const { data: subs } = await db.from('member_subscriptions').select('*').eq('status', 'active');
  for (const s of subs ?? []) {
    if (!s.ends_at) continue;
    const endAt = new Date(s.ends_at);

    if (endAt <= now) {
      if (s.next_plan_code) {
        const { data: plan } = await db.from('member_plans').select('*').eq('code', s.next_plan_code).single();
        if (plan) {
          const nextEnd = plan.duration_days ? new Date(now.getTime() + Number(plan.duration_days) * 86_400_000).toISOString() : null;
          await db.from('member_subscriptions').update({
            plan_code: plan.code,
            starts_at: nowIso,
            ends_at: nextEnd,
            next_plan_code: null,
            next_plan_start_at: null,
            updated_at: nowIso,
          }).eq('user_id', s.user_id);
          await db.from('credit_wallets').update({
            monthly_balance: plan.monthly_credit_allocation,
            monthly_allocation: plan.monthly_credit_allocation,
            monthly_reset_month: nowIso.slice(0, 7) + '-01',
            updated_at: nowIso,
          }).eq('user_id', s.user_id);
        }
      } else if (s.plan_code !== 'free') {
        const { data: free } = await db.from('member_plans').select('*').eq('code', 'free').single();
        if (free) {
          await db.from('member_subscriptions').update({ plan_code: 'free', starts_at: nowIso, ends_at: null, updated_at: nowIso }).eq('user_id', s.user_id);
          await db.from('credit_wallets').update({
            monthly_balance: free.monthly_credit_allocation,
            monthly_allocation: free.monthly_credit_allocation,
            monthly_reset_month: nowIso.slice(0, 7) + '-01',
            updated_at: nowIso,
          }).eq('user_id', s.user_id);
          await db.from('member_notifications').insert({
            user_id: s.user_id,
            type: 'pro_expired',
            title: 'Pro หมดอายุแล้ว',
            message: 'บัญชีของคุณกลับเป็น Free แล้ว เครดิตที่ซื้อเพิ่มยังคงอยู่',
          });
        }
      }
      continue;
    }

    const days = (endAt.getTime() - now.getTime()) / 86_400_000;
    for (const d of [7, 1]) {
      if (!(days > 0 && days <= d && days > d - 1)) continue;
      const type = `pro_expiry_${d}`;
      const { data: exists } = await db.from('member_notifications').select('id').eq('user_id', s.user_id).eq('type', type).gte('created_at', new Date(now.getTime() - 2 * 86_400_000).toISOString()).maybeSingle();
      if (!exists) {
        await db.from('member_notifications').insert({
          user_id: s.user_id,
          type,
          title: `Pro จะหมดอายุใน ${d} วัน`,
          message: 'ต่ออายุเพื่อใช้งานสิทธิ์ Pro ต่อเนื่อง',
        });
      }
    }
  }

  const cutoff = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const { data: deleting } = await db.from('profiles').select('user_id,avatar_path').not('deletion_requested_at', 'is', null).lte('deletion_requested_at', cutoff).limit(100);
  for (const profile of deleting ?? []) {
    if (profile.avatar_path) await db.storage.from('member-avatars').remove([profile.avatar_path]);
    await db.auth.admin.deleteUser(profile.user_id);
  }

  return NextResponse.json({ ok: true, removedReferences: refs?.length ?? 0, deletedMembers: deleting?.length ?? 0 });
}
