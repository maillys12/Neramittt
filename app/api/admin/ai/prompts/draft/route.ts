import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin/auth';
import { savePromptDraft } from '@/lib/ai/prompts';
const Body=z.object({promptType:z.enum(['system','creative_director']),content:z.string().trim().min(1).max(50000),changeNote:z.string().trim().max(500).optional()});
export async function PATCH(req:Request){
  try{await requireAdmin(req);const body=Body.parse(await req.json());return NextResponse.json({ok:true,draft:await savePromptDraft(body)});}
  catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'PROMPT_DRAFT_FAILED'},{status:400});}
}
