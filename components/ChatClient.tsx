'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import {getOrCreateDeviceToken} from '@/lib/device/token';
import {AiThinkingBubble} from '@/components/ui/LoadingStates';
import {Toast} from '@/components/ui/Toast';
import {chatSummaryRows} from '@/lib/ui/format';
import {CreationSettingsControls} from '@/components/ui/CreationSettingsControls';
import {NeramitIcon} from '@/components/ui/NeramitIcon';
import {normalizeCreationSettings,settingsPatch,type CreationSettings} from '@/lib/ui/creation-settings';
import {sendChatOptimistically} from '@/lib/ui/chat-send';
import {splitChatMarkdown} from '@/lib/ui/chat-markdown';

type Item={role:'user'|'assistant';content:string};
type Brief=Record<string,unknown>;

export default function ChatClient(){
  const[draft,setDraft]=useState('');const[msg,setMsg]=useState('');const[items,setItems]=useState<Item[]>([]);const[busy,setBusy]=useState(false);const[brief,setBrief]=useState<Brief>({});const[error,setError]=useState('');const[notice,setNotice]=useState('');const[settings,setSettings]=useState<CreationSettings>(()=>normalizeCreationSettings({}));const chatEndRef=useRef<HTMLDivElement|null>(null);
  const summary=useMemo(()=>chatSummaryRows(brief),[brief]);
  useEffect(()=>{if(items.length||busy)chatEndRef.current?.scrollIntoView({behavior:'smooth',block:'nearest'});},[items,busy]);
  async function persistSettings(next:CreationSettings){setSettings(next);setBrief(v=>({...v,...settingsPatch(next)}));if(!draft)return;try{await fetch(`/api/drafts/${draft}`,{method:'PATCH',headers:{'content-type':'application/json','x-neramit-device':getOrCreateDeviceToken()},body:JSON.stringify({brief:{...brief,...settingsPatch(next)}})});}catch{}}
  async function copyPrompt(text:string){try{await navigator.clipboard.writeText(text);setNotice(settings.language==='en'?'Prompt copied':'คัดลอกพรอมต์แล้ว');window.setTimeout(()=>setNotice(''),1600);}catch{setError(settings.language==='en'?'Could not copy the prompt':'คัดลอกพรอมต์ไม่สำเร็จ');}}
  async function send(){
    const original=msg.trim();if(!original||busy)return;setBusy(true);setError('');
    try{
      const result=await sendChatOptimistically({
        message:original,
        appendUser:user=>setItems(v=>[...v,{role:'user',content:user}]),
        clearInput:()=>setMsg(''),
        ensureDraft:async()=>{
          if(draft)return draft;
          const r=await fetch('/api/drafts',{method:'POST',headers:{'content-type':'application/json','x-neramit-device':getOrCreateDeviceToken()},body:JSON.stringify({mode:'chat',brief:{...brief,...settingsPatch(settings)}})});
          const x=await r.json();if(!x.draft?.id)throw new Error(x.error||'สร้างดราฟต์ไม่สำเร็จ');
          const id=x.draft.id as string;setDraft(id);return id;
        },
        requestAssistant:async(id,user)=>{
          const r=await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json','x-neramit-device':getOrCreateDeviceToken()},body:JSON.stringify({draftId:id,message:user,settings})});
          const x=await r.json();if(!r.ok)throw new Error(x.error||'ส่งข้อความไม่สำเร็จ');
          return{message:x.message,brief:x.brief&&typeof x.brief==='object'?x.brief:undefined};
        },
      });
      if(!result)return;
      setItems(v=>[...v,{role:'assistant',content:result.message}]);
      if(result.brief){setBrief(result.brief);setSettings(normalizeCreationSettings(result.brief));}
    }catch(e){setError(e instanceof Error?e.message:'เกิดข้อผิดพลาด');}
    finally{setBusy(false);}
  }
  const starter=settings.language==='en'?'What would you like to create today?':'วันนี้อยากสร้างโปสเตอร์เกี่ยวกับอะไร?';
  const placeholder=settings.language==='en'?'Describe your idea...':'พิมพ์ไอเดียของคุณ...';
  return <div className="chatWorkspace">
    <section className="chatPanel">
      <div className="chatToolbar"><CreationSettingsControls value={settings} onChange={persistSettings} compact/></div>
      <div className="chatBox" aria-live="polite">
        {items.length===0&&<div className="starterMessage"><span className="aiAvatar"><NeramitIcon name="spark" size={21}/></span><div><strong>คุยกับเนรมิต</strong><p>{starter}</p></div></div>}
        {items.map((x,i)=><div key={i} className={`messageRow ${x.role}`}><span className="messageAvatar" aria-hidden="true"><NeramitIcon name={x.role==='assistant'?'spark':'user'} size={18}/></span>{x.role==='assistant'?<div className="bubble assistant bubble--rich"><div className="assistantContent">{splitChatMarkdown(x.content).map((segment,j)=>segment.type==='code'?<div className="promptCodeBlock" key={`${i}-${j}`}><div className="promptCodeHeader"><span>{settings.language==='en'?'Prompt':'พรอมต์'}</span><button type="button" onClick={()=>void copyPrompt(segment.content)}><NeramitIcon name="document" size={16}/>{settings.language==='en'?'Copy':'คัดลอก'}</button></div><pre><code>{segment.content}</code></pre></div>:<div className="assistantText" key={`${i}-${j}`}>{segment.content}</div>)}</div></div>:<div className="bubble user">{x.content}</div>}</div>)}
        {busy&&<AiThinkingBubble/>}
        <div ref={chatEndRef} aria-hidden="true"/>
      </div>
      <div className="composerCard"><textarea value={msg} onChange={e=>setMsg(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send();}}} placeholder={placeholder} rows={2}/><button className="sendButton" onClick={send} disabled={busy||!msg.trim()} aria-label="ส่งข้อความ"><NeramitIcon name="send" size={23}/></button></div>
      <div className="chatBottom"><span>แนบภาพได้สูงสุด 4 ภาพ</span><button className="textButton iconTextButton" onClick={()=>{setItems([]);setBrief({});setDraft('');setSettings(normalizeCreationSettings({}));}}><NeramitIcon name="refresh" size={16}/>เริ่มใหม่</button></div>
      {error&&<Toast message={error} tone="error"/>}{notice&&<Toast message={notice} tone="success"/>}
    </section>
    <aside className="summaryPanel">
      <div className="summaryTitle"><div><span className="eyebrowSmall">สรุปไอเดียของคุณ</span><h2>รายละเอียดที่เนรมิตเข้าใจ</h2></div><NeramitIcon name="edit" size={19}/></div>
      <div className="summaryRows">{summary.length?summary.map(([label,value])=><div className="summaryRow" key={label}><span>{label}</span><strong>{value}</strong></div>):<div className="summaryEmpty">เริ่มคุยก่อน แล้วสรุปงานจะขึ้นตรงนี้อัตโนมัติ</div>}</div>
      <div className="summaryTip"><NeramitIcon name="spark" size={23}/><span>เมื่อข้อมูลพอ เนรมิตจะสร้างพรอมต์<br/>ในแชทให้อัตโนมัติ</span></div>
    </aside>
  </div>
}
