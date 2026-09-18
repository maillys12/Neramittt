import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin/auth';
import { publishPrompt } from '@/lib/ai/prompts';
import { createAdminNotification } from '@/lib/ai/notifications';
const Body=z.object({promptType:z.enum(['system','creative_director']),draftId:z.string().uuid(),confirm:z.literal(true)});
export async function POST(req:Request){
  try{
    await requireAdmin(req);const body=Body.parse(await req.json());const published=await publishPrompt(body);
    await createAdminNotification({severity:'info',source:'prompts',title:'Prompt published',message:`${body.promptType} v${published.version} is now live.`});
    return NextResponse.json({ok:true,published});
  }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'PROMPT_PUBLISH_FAILED'},{status:400});}
}
