import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { AI_STAGES, REASONING_EFFORTS } from '@/lib/ai/types';
import { ALLOWED_AI_MODELS } from '@/lib/ai/safe-defaults';
import { getAIRuntimeConfig, invalidateAIRuntimeConfigCache } from '@/lib/ai/config';
import { writeAdminAudit } from '@/lib/admin/audit';

const Model=z.enum(ALLOWED_AI_MODELS);
const Stage=z.enum(AI_STAGES);
const Effort=z.enum(REASONING_EFFORTS);
const Body=z.object({
  autoRoutingEnabled:z.boolean().optional(),
  stage:z.object({
    stage:Stage,
    mode:z.enum(['auto','manual']),
    modelOverride:Model.nullable(),
    fallbackModel:Model,
    reasoningEffort:Effort,
    maxOutputTokens:z.number().int().min(128).max(128000),
  }).optional(),
}).refine(v=>v.autoRoutingEnabled!==undefined||v.stage!==undefined);

export async function GET(req:Request){
  try{await requireAdmin(req);return NextResponse.json({ok:true,config:await getAIRuntimeConfig({bypassCache:true}),allowedModels:ALLOWED_AI_MODELS,reasoningEfforts:REASONING_EFFORTS});}
  catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'ADMIN_AI_MODELS_FAILED'},{status:401});}
}

export async function PATCH(req:Request){
  try{
    await requireAdmin(req);
    const body=Body.parse(await req.json());
    const before=await getAIRuntimeConfig({bypassCache:true});
    const db=getServerSupabase();
    if(body.autoRoutingEnabled!==undefined){
      const {error}=await db.from('ai_runtime_config').update({auto_routing_enabled:body.autoRoutingEnabled,updated_at:new Date().toISOString()}).eq('id',1);if(error)throw error;
    }
    if(body.stage){
      const s=body.stage;
      const {error}=await db.from('ai_stage_config').upsert({
        stage:s.stage,mode:s.mode,model_override:s.modelOverride,fallback_model:s.fallbackModel,reasoning_effort:s.reasoningEffort,max_output_tokens:s.maxOutputTokens,updated_at:new Date().toISOString(),
      });if(error)throw error;
    }
    invalidateAIRuntimeConfigCache();
    const after=await getAIRuntimeConfig({bypassCache:true});
    await writeAdminAudit({action:'ai_models_updated',subjectType:'ai_runtime',previousValue:before,newValue:after});
    return NextResponse.json({ok:true,config:after});
  }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'ADMIN_AI_MODELS_FAILED'},{status:400});}
}
