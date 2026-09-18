import { NextResponse } from 'next/server';
import { requireMember } from '@/lib/member/auth';
import { getMemberSnapshot } from '@/lib/member/access';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET(req: Request) {
  try {
    const member = await requireMember(req);
    const snapshot = await getMemberSnapshot(member.userId);
    const db = getServerSupabase();
    const [{ data: creations }, { data: notifications }] = await Promise.all([
      db.from('member_creations').select('id,title,pinned,updated_at,draft_id').eq('user_id', member.userId).is('deleted_at', null).order('updated_at', { ascending: false }).limit(5),
      db.from('member_notifications').select('id,type,title,message,read_at,created_at').eq('user_id', member.userId).order('created_at', { ascending: false }).limit(5),
    ]);
    return NextResponse.json({ ok: true, ...snapshot, creations: creations ?? [], notifications: notifications ?? [], email: member.email });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'MEMBER_SUMMARY_FAILED' }, { status: 401 });
  }
}
