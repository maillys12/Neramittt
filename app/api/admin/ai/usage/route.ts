import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin/auth';
import { getServerSupabase } from '@/lib/supabase/server';

const Query=z.object({
  range:z.enum(['today','7d','30d','month','billing','all','custom']).default('30d'),
  from:z.string().datetime().optional(),
  to:z.string().datetime().optional(),
  includeTests:z.enum(['true','false']).default('false'),
});

function rangeWindow(range:string,from?:string,to?:string){
  const now=new Date();
  if(range==='custom'){
    if(!from||!to)throw new Error('DATE_RANGE_REQUIRED');
    return {from:new Date(from),to:new Date(to)};
  }
  if(range==='today')return {from:new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())),to:now};
  if(range==='7d')return {from:new Date(now.getTime()-7*86400000),to:now};
  if(range==='30d')return {from:new Date(now.getTime()-30*86400000),to:now};
  if(range==='month'||range==='billing')return {from:new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)),to:now};
  return {from:new Date(0),to:now};
}

export async function GET(req:Request){
  try{
    await requireAdmin(req);
    const url=new URL(req.url);
    const q=Query.parse(Object.fromEntries(url.searchParams.entries()));
    const window=rangeWindow(q.range,q.from,q.to);
    if(window.from>window.to)throw new Error('DATE_RANGE_INVALID');
    const db=getServerSupabase();
    let query=db.from('ai_usage_events').select('request_id,execution_mode,stage,model,input_tokens,output_tokens,cached_tokens,tool_calls,estimated_cost_usd,estimated_cost_thb,duration_ms,status,error_code,created_at')
      .gte('created_at',window.from.toISOString()).lte('created_at',window.to.toISOString()).order('created_at',{ascending:false}).limit(5000);
    if(q.includeTests!=='true')query=query.eq('execution_mode','production');
    const {data,error}=await query;
    if(error)throw error;
    const rows=data??[];
    const totals=rows.reduce((acc,row)=>({
      costUsd:acc.costUsd+Number(row.estimated_cost_usd??0),
      costThb:acc.costThb+Number(row.estimated_cost_thb??0),
      requests:acc.requests+1,
      inputTokens:acc.inputTokens+Number(row.input_tokens??0),
      outputTokens:acc.outputTokens+Number(row.output_tokens??0),
      cachedTokens:acc.cachedTokens+Number(row.cached_tokens??0),
      toolCalls:acc.toolCalls+Number(row.tool_calls??0),
      errors:acc.errors+(row.status==='error'?1:0),
    }),{costUsd:0,costThb:0,requests:0,inputTokens:0,outputTokens:0,cachedTokens:0,toolCalls:0,errors:0});
    const byModel:Record<string,{costThb:number;requests:number}>= {};
    const byStage:Record<string,{costThb:number;requests:number}>= {};
    const buckets:Record<string,{costThb:number;requests:number;tokens:number}>= {};
    for(const row of rows){
      const model=String(row.model),stage=String(row.stage),day=String(row.created_at).slice(0,10),cost=Number(row.estimated_cost_thb??0);
      byModel[model]??={costThb:0,requests:0};byModel[model].costThb+=cost;byModel[model].requests++;
      byStage[stage]??={costThb:0,requests:0};byStage[stage].costThb+=cost;byStage[stage].requests++;
      buckets[day]??={costThb:0,requests:0,tokens:0};buckets[day].costThb+=cost;buckets[day].requests++;buckets[day].tokens+=Number(row.input_tokens??0)+Number(row.output_tokens??0);
    }
    return NextResponse.json({ok:true,window:{from:window.from.toISOString(),to:window.to.toISOString()},totals,byModel,byStage,series:Object.entries(buckets).sort(([a],[b])=>a.localeCompare(b)).map(([date,value])=>({date,...value})),recent:rows.slice(0,100)});
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:'ADMIN_AI_USAGE_FAILED'},{status:400});
  }
}
