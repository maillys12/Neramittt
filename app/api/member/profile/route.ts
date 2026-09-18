import { NextResponse } from 'next/server';
import { requireMember, getMemberScopedClient } from '@/lib/member/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { onboardingSchema, profileUpdateSchema } from '@/lib/member/profile';

async function serializeProfile(userId: string) {
  const db = getServerSupabase();
  const { data, error } = await db.from('profiles').select('*').eq('user_id', userId).single();
  if (error) throw error;
  let avatarUrl: string | null = null;
  if (data.avatar_path) {
    const { data: signed } = await db.storage.from('member-avatars').createSignedUrl(data.avatar_path, 3600);
    avatarUrl = signed?.signedUrl ?? null;
  }
  return { ...data, avatarUrl };
}

export async function GET(req: Request) {
  try {
    const member = await requireMember(req);
    return NextResponse.json({ ok: true, profile: await serializeProfile(member.userId), email: member.email });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'PROFILE_FAILED' }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const member = await requireMember(req);
    const input = onboardingSchema.parse(await req.json());
    const client = getMemberScopedClient(member.accessToken);
    const { data, error } = await client.rpc('create_member_profile', {
      p_username: input.username,
      p_display_name: input.displayName,
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, profile: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PROFILE_CREATE_FAILED';
    return NextResponse.json({ ok: false, error: message }, { status: message.includes('TAKEN') ? 409 : 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    const member = await requireMember(req);
    const input = profileUpdateSchema.parse(await req.json());
    const db = getServerSupabase();
    const { error } = await db.from('profiles').update({ display_name: input.displayName, updated_at: new Date().toISOString() }).eq('user_id', member.userId);
    if (error) throw error;
    return NextResponse.json({ ok: true, profile: await serializeProfile(member.userId) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'PROFILE_UPDATE_FAILED' }, { status: 400 });
  }
}
