import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { ALLOWED_AI_MODELS } from '@/lib/ai/safe-defaults';
import { AI_STAGES,REASONING_EFFORTS } from '@/lib/ai/types';
import { writeAdminAudit } from '@/lib/admin/audit';

const Base=z.object({
  enabled:z.boolean(),priority:z.number().int().min(0).max(10000),
  conditionMetric:z.enum(['budget_used_percent','budget_remaining_thb','daily_cost_thb','monthly_cost_thb']),
  operator:z.enum(['gte','lte','gt','lt']),threshold:z.number().finite(),
  action:z.enum(['notify_warning','notify_critical','cost_saver','reduce_reasoning','force_model','disable_stage','pause_ai']),
  actionConfig:z.record(z.unknown()).default({}),
});
function validateConfig(body:z.infer<typeof Base>){
  if(body.action==='force_model'&&!ALLOWED_AI_MODELS.includes(String(body.actionConfig.model) as never))throw new Error('MODEL_NOT_ALLOWED');
  if(body.action==='disable_stage'&&!AI_STAGES.includes(String(body.actionConfig.stage) as never))throw new Error('STAGE_INVALID');
  if(body.action==='reduce_reasoning'&&!REASONING_EFFORTS.includes(String(body.actionConfig.effort) as never))throw new Error('REASONING_INVALID');
}
export async function GET(req:Request){try{await requireAdmin(req);const db=getServerSupabase();const{data,error}=await db.from('ai_budget_rules').select('*').order('priority');if(error)throw error;return NextResponse.json({ok:true,rules:data??[]});}catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'BUDGET_RULES_FAILED'},{status:401});}}
export async function POST(req:Request){
  try{await requireAdmin(req);const body=Base.parse(await req.json());validateConfig(body);const db=getServerSupabase();const{data,error}=await db.from('ai_budget_rules').insert({enabled:body.enabled,priority:body.priority,condition_metric:body.conditionMetric,operator:body.operator,threshold:body.threshold,action:body.action,action_config:body.actionConfig}).select('*').single();if(error)throw error;await writeAdminAudit({action:'ai_budget_rule_created',subjectType:'ai_budget_rule',subjectId:String(data.id),newValue:data});return NextResponse.json({ok:true,rule:data});}catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'BUDGET_RULES_FAILED'},{status:400});}
}
export async function PATCH(req:Request){
  try{await requireAdmin(req);const raw=await req.json();const id=z.string().uuid().parse(raw.id);const body=Base.parse(raw);validateConfig(body);const db=getServerSupabase();const{data:before}=await db.from('ai_budget_rules').select('*').eq('id',id).single();const{data,error}=await db.from('ai_budget_rules').update({enabled:body.enabled,priority:body.priority,condition_metric:body.conditionMetric,operator:body.operator,threshold:body.threshold,action:body.action,action_config:body.actionConfig,updated_at:new Date().toISOString()}).eq('id',id).select('*').single();if(error)throw error;await writeAdminAudit({action:'ai_budget_rule_updated',subjectType:'ai_budget_rule',subjectId:id,previousValue:before,newValue:data});return NextResponse.json({ok:true,rule:data});}catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'BUDGET_RULES_FAILED'},{status:400});}
}
