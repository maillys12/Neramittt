'use client';

import {useMemo,useState} from 'react';
import Link from 'next/link';
import {getOrCreateDeviceToken} from '@/lib/device/token';
import {AiThinkingBubble} from '@/components/ui/LoadingStates';
import {Toast} from '@/components/ui/Toast';
import {chatSummaryRows} from '@/lib/ui/format';
import {CreationSettingsControls} from '@/components/ui/CreationSettingsControls';
import {NeramitIcon} from '@/components/ui/NeramitIcon';
import {normalizeCreationSettings,settingsPatch,type CreationSettings} from '@/lib/ui/creation-settings';

type Item={role:'user'|'assistant';content:string};
type Brief=Record<string,unknown>;

export default function ChatClient(){
  const[draft,setDraft]=useState('');const[msg,setMsg]=useState('');const[items,setItems]=useState<Item[]>([]);const[busy,setBusy]=useState(false);const[brief,setBrief]=useState<Brief>({});const[error,setError]=useState('');const[settings,setSettings]=useState<CreationSettings>(()=>normalizeCreationSettings({}));
  const summary=useMemo(()=>chatSummaryRows(brief),[brief]);
  async function persistSettings(next:CreationSettings){setSettings(next);setBrief(v=>({...v,...settingsPatch(next)}));if(!draft)return;try{await fetch(`/api/drafts/${draft}`,{method:'PATCH',headers:{'content-type':'application/json','x-neramit-device':getOrCreateDeviceToken()},body:JSON.stringify({brief:{...brief,...settingsPatch(next)}})});}catch{}}
  async function send(){if(!msg.trim()||busy)return;setBusy(true);setError('');try{let id=draft;if(!id){const r=await fetch('/api/drafts',{method:'POST',headers:{'content-type':'application/json','x-neramit-device':getOrCreateDeviceToken()},body:JSON.stringify({mode:'chat',brief:{...brief,...settingsPatch(settings)}})});const x=await r.json();if(!x.draft?.id)throw new Error(x.error||'สร้างดราฟต์ไม่สำเร็จ');id=x.draft.id;setDraft(id);}const user=msg.trim();setItems(v=>[...v,{role:'user',content:user}]);setMsg('');const r=await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json','x-neramit-device':getOrCreateDeviceToken()},body:JSON.stringify({draftId:id,message:user})});const x=await r.json();if(!r.ok)throw new Error(x.error||'ส่งข้อความไม่สำเร็จ');setItems(v=>[...v,{role:'assistant',content:x.message}]);if(x.brief&&typeof x.brief==='object'){setBrief(x.brief);setSettings(normalizeCreationSettings(x.brief));}}catch(e){setError(e instanceof Error?e.message:'เกิดข้อผิดพลาด');}finally{setBusy(false);}}
  return <div className="chatWorkspace">
    <section className="chatPanel">
      <div className="chatToolbar"><CreationSettingsControls value={settings} onChange={persistSettings} compact/></div>
      <div className="chatBox" aria-live="polite">
        {items.length===0&&<div className="starterMessage"><span className="aiAvatar"><NeramitIcon name="spark" size={21}/></span><div><strong>คุยกับเนรมิต</strong><p>วันนี้อยากสร้างโปสเตอร์เกี่ยวกับอะไร?</p></div></div>}
        {items.map((x,i)=><div key={i} className={`messageRow ${x.role}`}><span className="messageAvatar" aria-hidden="true"><NeramitIcon name={x.role==='assistant'?'spark':'user'} size={18}/></span><div className={`bubble ${x.role}`}>{x.content}</div></div>)}
        {busy&&<AiThinkingBubble/>}
      </div>
      <div className="composerCard"><textarea value={msg} onChange={e=>setMsg(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send();}}} placeholder="พิมพ์ไอเดียของคุณ..." rows={2}/><button className="sendButton" onClick={send} disabled={busy||!msg.trim()} aria-label="ส่งข้อความ"><NeramitIcon name="send" size={23}/></button></div>
      <div className="chatBottom"><span>แนบภาพได้สูงสุด 4 ภาพ</span><button className="textButton iconTextButton" onClick={()=>{setItems([]);setBrief({});setDraft('');setSettings(normalizeCreationSettings({}));}}><NeramitIcon name="refresh" size={16}/>เริ่มใหม่</button></div>
      {error&&<Toast message={error} tone="error"/>}
    </section>
    <aside className="summaryPanel">
      <div className="summaryTitle"><div><span className="eyebrowSmall">สรุปไอเดียของคุณ</span><h2>รายละเอียดที่เนรมิตเข้าใจ</h2></div><NeramitIcon name="edit" size={19}/></div>
      <div className="summaryRows">{summary.length?summary.map(([label,value])=><div className="summaryRow" key={label}><span>{label}</span><strong>{value}</strong></div>):<div className="summaryEmpty">เริ่มคุยก่อน แล้วสรุปงานจะขึ้นตรงนี้อัตโนมัติ</div>}</div>
      <div className="summaryTip"><NeramitIcon name="spark" size={23}/><span>เติมรายละเอียดอีกนิด<br/>แล้วพร้อมสร้างพรอมต์</span></div>
      {draft?<Link className="outlineButton" href={`/references?draft=${draft}`}><NeramitIcon name="search" size={18}/>ตรวจสรุปข้อมูล</Link>:<button className="outlineButton" disabled><NeramitIcon name="search" size={18}/>ตรวจสรุปข้อมูล</button>}
      {draft?<Link className="gradientButton fullButton" href={`/references?draft=${draft}`}>ไปภาพอ้างอิง <NeramitIcon name="chevronRight" size={18}/></Link>:<button className="gradientButton fullButton" disabled>สร้างพรอมต์</button>}
    </aside>
  </div>
}
