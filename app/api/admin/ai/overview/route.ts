import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { getBudgetSnapshot } from '@/lib/ai/budget';
import { getProviderBillingSnapshot } from '@/lib/ai/provider-billing';
import { getAIRuntimeConfig } from '@/lib/ai/config';
import { getPublishedPrompt } from '@/lib/ai/prompts';
import { getBudgetGuardForStage } from '@/lib/ai/runtime';

function summarize(rows: Array<Record<string, unknown>>) {
  return rows.reduce((acc,row)=>({
    costThb: acc.costThb + Number(row.estimated_cost_thb ?? 0),
    requests: acc.requests + 1,
    inputTokens: acc.inputTokens + Number(row.input_tokens ?? 0),
    outputTokens: acc.outputTokens + Number(row.output_tokens ?? 0),
  }),{costThb:0,requests:0,inputTokens:0,outputTokens:0});
}

export async function GET(req:Request){
  try{
    await requireAdmin(req);
    const db=getServerSupabase();
    const now=new Date();
    const today=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())).toISOString();
    const month=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)).toISOString();
    const [usage,unread,budget,providerBilling,runtime,systemPrompt,creativePrompt,budgetGuard]=await Promise.all([
      db.from('ai_usage_events').select('estimated_cost_thb,input_tokens,output_tokens,created_at').eq('execution_mode','production').gte('created_at',month).order('created_at',{ascending:false}).limit(5000),
      db.from('admin_notifications').select('id',{count:'exact',head:true}).is('read_at',null),
      getBudgetSnapshot(),
      getProviderBillingSnapshot(),
      getAIRuntimeConfig(),
      getPublishedPrompt('system').catch(()=>null),
      getPublishedPrompt('creative_director').catch(()=>null),
      getBudgetGuardForStage('creative_director',{notify:false}),
    ]);
    if(usage.error)throw usage.error;
    const monthRows=(usage.data??[]) as Array<Record<string,unknown>>;
    const todayRows=monthRows.filter(row=>String(row.created_at)>=today);
    return NextResponse.json({
      ok:true,
      budget,
      providerBilling,
      today:{...summarize(todayRows),creditUsedThb:summarize(todayRows).costThb},
      month:{...summarize(monthRows),creditUsedThb:summarize(monthRows).costThb},
      unreadNotifications:unread.count??0,
      runtime:{safeMode:runtime.safeMode,autoRoutingEnabled:runtime.autoRoutingEnabled,operatingMode:runtime.safeMode?'safe_mode':budgetGuard.mode},
      publishedPrompts:{system:systemPrompt?.version??null,creativeDirector:creativePrompt?.version??null},
    });
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:'ADMIN_AI_OVERVIEW_FAILED'},{status:401});
  }
}
