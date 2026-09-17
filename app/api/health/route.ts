import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const pepper = process.env.DEVICE_TOKEN_PEPPER || '';

  const diagnostics: Record<string, unknown> = {
    env: {
      supabaseUrl: Boolean(url),
      supabaseSecret: Boolean(key),
      devicePepper: Boolean(pepper),
      openaiKey: Boolean(process.env.OPENAI_API_KEY),
      adminHash: Boolean(process.env.ADMIN_PASSWORD_HASH),
      cronSecret: Boolean(process.env.CRON_SECRET),
    },
    format: {
      supabaseUrlLooksValid: /^https:\/\/[a-z0-9]+\.supabase\.co$/i.test(url),
      supabaseSecretType: key.startsWith('sb_secret_') ? 'sb_secret' : key.startsWith('eyJ') ? 'legacy_jwt' : key ? 'unknown' : 'missing',
      pepperLengthOk: pepper.length >= 32,
    },
  };

  if (!url || !key) {
    return NextResponse.json({ ok: false, ...diagnostics, stage: 'env' }, { status: 503 });
  }

  try {
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await db.from('devices').select('id').limit(1);
    if (error) {
      return NextResponse.json({ ok: false, ...diagnostics, stage: 'supabase', error: error.message }, { status: 503 });
    }
    return NextResponse.json({ ok: true, ...diagnostics, stage: 'ready' });
  } catch (error) {
    return NextResponse.json({ ok: false, ...diagnostics, stage: 'exception', error: error instanceof Error ? error.message : 'UNKNOWN' }, { status: 503 });
  }
}
