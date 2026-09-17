import{NextResponse}from'next/server';
import{z}from'zod';
import{readDeviceToken}from'@/lib/http/device';
import{resolveDevice}from'@/lib/device/server';
import{getServerSupabase}from'@/lib/supabase/server';
import{getOpenAI}from'@/lib/openai/client';

const S=z.object({draftId:z.string().uuid(),message:z.string().min(1).max(5000)});
const CHAT_CONTEXT_LIMIT=12;

export async function POST(req:Request){
  try{
    const device=await resolveDevice(readDeviceToken(req));
    const input=S.parse(await req.json());
    const db=getServerSupabase();
    const{data:draft,error}=await db.from('drafts').select('id,brief').eq('id',input.draftId).eq('device_id',device.id).single();
    if(error)throw error;
    const{error:insertError}=await db.from('chat_messages').insert({draft_id:draft.id,role:'user',content:input.message});
    if(insertError)throw insertError;
    const{data:messages,error:messageError}=await db.from('chat_messages').select('role,content').eq('draft_id',draft.id).order('created_at',{ascending:false}).limit(CHAT_CONTEXT_LIMIT);
    if(messageError)throw messageError;
    const chronological=[...(messages??[])].reverse();
    const ai=await getOpenAI().responses.create({
      model:'gpt-5.6-luna',
      reasoning:{effort:'none'},
      store:false,
      max_output_tokens:220,
      instructions:'คุณคือ Neramit ผู้ช่วยเก็บ creative brief สำหรับสร้างภาพและโปสเตอร์ ตอบภาษาไทยแบบกระชับและเป็นธรรมชาติ ถามครั้งละไม่เกิน 1-2 เรื่องเฉพาะข้อมูลสำคัญที่ยังขาด ห้ามถามซ้ำสิ่งที่ผู้ใช้ตอบแล้ว ห้ามแต่งข้อมูลแทนผู้ใช้ เมื่อข้อมูลเพียงพอให้สรุปสั้น ๆ และบอกว่าสามารถไปขั้นถัดไปได้',
      input:chronological.map(m=>`${m.role}: ${m.content}`).join('\n')
    });
    const text=ai.output_text||'รับข้อมูลแล้วครับ';
    const prior=draft.brief&&typeof draft.brief==='object'&&!Array.isArray(draft.brief)?draft.brief as Record<string,unknown>:{};
    const nextBrief={...prior,conversation_summary:text};
    const [assistantWrite,draftWrite]=await Promise.all([
      db.from('chat_messages').insert({draft_id:draft.id,role:'assistant',content:text}),
      db.from('drafts').update({brief:nextBrief,updated_at:new Date().toISOString()}).eq('id',draft.id).eq('device_id',device.id)
    ]);
    if(assistantWrite.error)throw assistantWrite.error;
    if(draftWrite.error)throw draftWrite.error;
    return NextResponse.json({ok:true,message:text,brief:nextBrief});
  }catch(e){
    return NextResponse.json({ok:false,error:e instanceof Error?e.message:'CHAT_FAILED'},{status:400});
  }
}
