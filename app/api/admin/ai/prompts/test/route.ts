import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin/auth';
import { CreationSettingsSchema } from '@/lib/chat/contracts';
import { generateResearchTurn } from '@/lib/chat/research';
import { isOfficialContext } from '@/lib/chat/orchestrator';
import { getDraftPrompt,getPublishedPrompt } from '@/lib/ai/prompts';
import { getServerSupabase } from '@/lib/supabase/server';

const Body=z.object({
  message:z.string().trim().min(1).max(5000),
  settings:CreationSettingsSchema,
  useDraft:z.boolean().default(true),
  assets:z.array(z.object({id:z.string(),kind:z.enum(['logo','reference']),authentic:z.boolean(),label:z.string().optional()})).max(4).default([]),
});

export async function POST(req:Request){
  try{
    await requireAdmin(req);const body=Body.parse(await req.json());
    const loader=body.useDraft?getDraftPrompt:getPublishedPrompt;
    const [system,creative]=await Promise.all([loader('system'),loader('creative_director')]);
    const started=Date.now();
    const requestId=randomUUID();
    const turn=await generateResearchTurn({
      message:body.message,history:[],settings:body.settings,assets:body.assets,officialContext:isOfficialContext(body.message),
      requestId,executionMode:'draft_test',
      promptOverrides:{system:system?.content,creativeDirector:creative?.content},
    });
    const db=getServerSupabase();
    const {data:usage}=await db.from('ai_usage_events')
      .select('stage,model,input_tokens,output_tokens,cached_tokens,estimated_cost_usd,estimated_cost_thb,duration_ms,status,retry_index')
      .eq('request_id',requestId).eq('execution_mode','draft_test').order('created_at');
    const telemetry=(usage??[]).reduce((acc,row)=>({
      inputTokens:acc.inputTokens+Number(row.input_tokens??0),
      outputTokens:acc.outputTokens+Number(row.output_tokens??0),
      cachedTokens:acc.cachedTokens+Number(row.cached_tokens??0),
      costUsd:acc.costUsd+Number(row.estimated_cost_usd??0),
      costThb:acc.costThb+Number(row.estimated_cost_thb??0),
    }),{inputTokens:0,outputTokens:0,cachedTokens:0,costUsd:0,costThb:0});
    return NextResponse.json({ok:true,mode:body.useDraft?'draft':'published',turn,durationMs:Date.now()-started,requestId,telemetry:{...telemetry,calls:usage??[]}});
  }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'PROMPT_TEST_FAILED'},{status:400});}
}
