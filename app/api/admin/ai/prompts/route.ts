import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin/auth';
import { getDraftPrompt,getPublishedPrompt,listPromptVersions } from '@/lib/ai/prompts';
const Type=z.enum(['system','creative_director']);
export async function GET(req:Request){
  try{
    await requireAdmin(req);const type=Type.parse(new URL(req.url).searchParams.get('type')??'creative_director');
    const [published,draft,versions]=await Promise.all([getPublishedPrompt(type),getDraftPrompt(type),listPromptVersions(type)]);
    return NextResponse.json({ok:true,type,published,draft,versions});
  }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'ADMIN_AI_PROMPTS_FAILED'},{status:400});}
}
