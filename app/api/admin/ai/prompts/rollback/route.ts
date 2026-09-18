import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin/auth';
import { rollbackPrompt } from '@/lib/ai/prompts';
import { createAdminNotification } from '@/lib/ai/notifications';
const Body=z.object({promptType:z.enum(['system','creative_director']),version:z.number().int().min(1),confirm:z.literal(true)});
export async function POST(req:Request){
  try{
    await requireAdmin(req);const body=Body.parse(await req.json());const published=await rollbackPrompt(body);
    await createAdminNotification({severity:'warning',source:'prompts',title:'Prompt rolled back',message:`${body.promptType} rolled back from history; new published version is v${published.version}.`});
    return NextResponse.json({ok:true,published});
  }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'PROMPT_ROLLBACK_FAILED'},{status:400});}
}
