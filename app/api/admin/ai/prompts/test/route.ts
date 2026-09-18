import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin/auth';
import { CreationSettingsSchema } from '@/lib/chat/contracts';
import { generateResearchTurn } from '@/lib/chat/research';
import { isOfficialContext } from '@/lib/chat/orchestrator';
import { getDraftPrompt,getPublishedPrompt } from '@/lib/ai/prompts';

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
    const turn=await generateResearchTurn({
      message:body.message,history:[],settings:body.settings,assets:body.assets,officialContext:isOfficialContext(body.message),
      requestId:randomUUID(),executionMode:'draft_test',
      promptOverrides:{system:system?.content,creativeDirector:creative?.content},
    });
    return NextResponse.json({ok:true,mode:body.useDraft?'draft':'published',turn,durationMs:Date.now()-started});
  }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'PROMPT_TEST_FAILED'},{status:400});}
}
