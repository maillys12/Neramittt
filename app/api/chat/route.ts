import{NextResponse}from'next/server';
import{z}from'zod';
import{readDeviceToken}from'@/lib/http/device';
import{resolveDevice}from'@/lib/device/server';
import{getServerSupabase}from'@/lib/supabase/server';
import{getOpenAI}from'@/lib/openai/client';
import{normalizeCreationSettings,settingsPatch}from'@/lib/ui/creation-settings';
import{buildChatInstructions}from'@/lib/ui/chat-instructions';
import{appendExactFinalRemark,buildPromptRepairInstructions,hasFencedPromptBlocks,sanitizeModelText,validateFinalPromptResponse}from'@/lib/ui/image-prompt-policy';

const CreationSettingsSchema=z.object({platform:z.enum(['chatgpt','gemini','canva','generic']),language:z.enum(['th','en']),variantCount:z.union([z.literal(1),z.literal(2),z.literal(3)])});
const S=z.object({draftId:z.string().uuid(),message:z.string().min(1).max(5000),settings:CreationSettingsSchema.optional()});
const CHAT_CONTEXT_LIMIT=12;

export async function POST(req:Request){
  try{
    const device=await resolveDevice(readDeviceToken(req));
    const input=S.parse(await req.json());
    const db=getServerSupabase();
    const{data:draft,error}=await db.from('drafts').select('id,brief').eq('id',input.draftId).eq('device_id',device.id).single();
    if(error)throw error;
    const prior=draft.brief&&typeof draft.brief==='object'&&!Array.isArray(draft.brief)?draft.brief as Record<string,unknown>:{};
    const settings=input.settings??normalizeCreationSettings(prior);
    const briefWithSettings={...prior,...settingsPatch(settings)};
    const{error:insertError}=await db.from('chat_messages').insert({draft_id:draft.id,role:'user',content:input.message});
    if(insertError)throw insertError;
    const{data:messages,error:messageError}=await db.from('chat_messages').select('role,content').eq('draft_id',draft.id).order('created_at',{ascending:false}).limit(CHAT_CONTEXT_LIMIT);
    if(messageError)throw messageError;
    const chronological=[...(messages??[])].reverse();
    const maxOutputTokens=settings.variantCount===3?1500:settings.variantCount===2?1100:800;
    const ai=await getOpenAI().responses.create({
      model:'gpt-5.6-luna',
      reasoning:{effort:'low'},
      store:false,
      max_output_tokens:maxOutputTokens,
      instructions:buildChatInstructions(settings),
      input:chronological.map(m=>`${m.role}: ${m.content}`).join('\n')
    });
    let text=sanitizeModelText(ai.output_text||'รับข้อมูลแล้วครับ เล่ารายละเอียดเพิ่มได้เลย');
    const looksLikeFinal=hasFencedPromptBlocks(text)||text.includes('Subject & Medium:')||text.includes('Parameters:');
    if(looksLikeFinal){
      text=appendExactFinalRemark(text);
      let validation=validateFinalPromptResponse(text,settings.variantCount);
      if(!validation.ok){
        const repaired=await getOpenAI().responses.create({
          model:'gpt-5.6-luna',
          reasoning:{effort:'low'},
          store:false,
          max_output_tokens:maxOutputTokens,
          instructions:buildPromptRepairInstructions(settings.variantCount),
          input:`Repair this response without changing the user's intended visual requirements:\n\n${text}`
        });
        text=appendExactFinalRemark(sanitizeModelText(repaired.output_text||''));
        validation=validateFinalPromptResponse(text,settings.variantCount);
        if(!validation.ok)throw new Error('PROMPT_FORMAT_FAILED');
      }
    }
    const nextBrief={...briefWithSettings,conversation_summary:text};
    const[assistantWrite,draftWrite]=await Promise.all([
      db.from('chat_messages').insert({draft_id:draft.id,role:'assistant',content:text}),
      db.from('drafts').update({brief:nextBrief,updated_at:new Date().toISOString()}).eq('id',draft.id).eq('device_id',device.id)
    ]);
    if(assistantWrite.error)throw assistantWrite.error;
    if(draftWrite.error)throw draftWrite.error;
    return NextResponse.json({ok:true,message:text,brief:nextBrief,settings});
  }catch(e){
    return NextResponse.json({ok:false,error:e instanceof Error?e.message:'CHAT_FAILED'},{status:400});
  }
}
