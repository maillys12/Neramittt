import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { getAIRuntimeConfig,invalidateAIRuntimeConfigCache } from '@/lib/ai/config';
import { writeAdminAudit } from '@/lib/admin/audit';
import { createAdminNotification } from '@/lib/ai/notifications';
const Body=z.object({enabled:z.boolean(),confirm:z.literal(true)});
export async function POST(req:Request){
  try{
    await requireAdmin(req);const body=Body.parse(await req.json());const before=await getAIRuntimeConfig({bypassCache:true});const db=getServerSupabase();
    const{error}=await db.from('ai_runtime_config').update({safe_mode:body.enabled,updated_at:new Date().toISOString()}).eq('id',1);if(error)throw error;
    invalidateAIRuntimeConfigCache();const after=await getAIRuntimeConfig({bypassCache:true});
    await Promise.all([
      writeAdminAudit({action:body.enabled?'ai_safe_mode_enabled':'ai_safe_mode_disabled',subjectType:'ai_runtime',previousValue:{safeMode:before.safeMode},newValue:{safeMode:after.safeMode}}),
      createAdminNotification({severity:body.enabled?'critical':'info',source:'safe_mode',title:body.enabled?'SAFE MODE ACTIVE':'Safe Mode disabled',message:body.enabled?'AI runtime is using code-level known-good defaults.':'Normal AI control-plane routing is active again.'}),
    ]);
    return NextResponse.json({ok:true,safeMode:after.safeMode});
  }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'SAFE_MODE_FAILED'},{status:400});}
}
