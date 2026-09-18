'use client';
import { useEffect,useState } from 'react';

type Version={id:string;version:number;status:string;content:string;changeNote:string|null;createdAt:string};
type Payload={published:Version|null;draft:Version|null;versions:Version[]};

export default function AIPromptsTab({token}:{token:string}) {
  const [type,setType]=useState<'system'|'creative_director'>('creative_director');
  const [data,setData]=useState<Payload|null>(null);
  const [content,setContent]=useState('');
  const [note,setNote]=useState('');
  const [message,setMessage]=useState('');
  const [testText,setTestText]=useState('สร้างโปสเตอร์รับสมัครนักศึกษารอบ Portfolio จำนวน 120 คน');
  const [publishedTest,setPublishedTest]=useState<unknown>(null);
  const [draftTest,setDraftTest]=useState<unknown>(null);

  async function load(){
    const r=await fetch('/api/admin/ai/prompts?type='+encodeURIComponent(type),{headers:{'x-neramit-admin':token}});
    const x=await r.json();
    if(r.ok){setData(x);setContent(x.draft?.content??x.published?.content??'');}
  }
  useEffect(()=>{void load();},[type,token]);

  async function save(){
    const r=await fetch('/api/admin/ai/prompts/draft',{method:'PATCH',headers:{'content-type':'application/json','x-neramit-admin':token},body:JSON.stringify({promptType:type,content,changeNote:note})});
    const x=await r.json();setMessage(r.ok?'บันทึก Draft แล้ว':x.error||'บันทึกไม่สำเร็จ');if(r.ok)void load();
  }
  async function publish(){
    if(!data?.draft||!window.confirm('Publish '+type+' v'+data.draft.version+' ให้ผู้ใช้จริง?'))return;
    const r=await fetch('/api/admin/ai/prompts/publish',{method:'POST',headers:{'content-type':'application/json','x-neramit-admin':token},body:JSON.stringify({promptType:type,draftId:data.draft.id,confirm:true})});
    const x=await r.json();setMessage(r.ok?'Publish สำเร็จ':x.error||'Publish ไม่สำเร็จ');if(r.ok)void load();
  }
  async function rollback(version:number){
    if(!window.confirm('Rollback ไปใช้เนื้อหา v'+version+'?'))return;
    const r=await fetch('/api/admin/ai/prompts/rollback',{method:'POST',headers:{'content-type':'application/json','x-neramit-admin':token},body:JSON.stringify({promptType:type,version,confirm:true})});
    const x=await r.json();setMessage(r.ok?'Rollback สำเร็จ':x.error||'Rollback ไม่สำเร็จ');if(r.ok)void load();
  }
  async function runTest(useDraft:boolean){
    const r=await fetch('/api/admin/ai/prompts/test',{method:'POST',headers:{'content-type':'application/json','x-neramit-admin':token},body:JSON.stringify({message:testText,useDraft,settings:{platform:'chatgpt',language:'th',variantCount:1},assets:[]})});
    const x=await r.json();
    if(useDraft)setDraftTest(x);else setPublishedTest(x);
  }

  const publishedLabel=data?.published?'v'+data.published.version:'— ใช้ค่าในโค้ด';
  const draftLabel=data?.draft?'v'+data.draft.version:'ใหม่';

  return <div className="aiStack">
    <div className="aiToolbar">
      <button className={type==='system'?'gradientButton':'outlineButton'} onClick={()=>setType('system')}>System Prompt</button>
      <button className={type==='creative_director'?'gradientButton':'outlineButton'} onClick={()=>setType('creative_director')}>Creative Director</button>
    </div>

    <div className="aiTwoCol">
      <article className="aiCard">
        <h3>Published {publishedLabel}</h3>
        <pre className="aiPromptPreview">{data?.published?.content||'ยังไม่มี Published override ระบบใช้ known-good prompt จากโค้ด'}</pre>
      </article>
      <article className="aiCard">
        <h3>Draft {draftLabel}</h3>
        <textarea className="aiPromptEditor" value={content} onChange={e=>setContent(e.target.value)} placeholder="เขียน prompt override ที่ต้องการทดสอบ"/>
        <input value={note} onChange={e=>setNote(e.target.value)} placeholder="หมายเหตุการเปลี่ยนแปลง"/>
        <div className="aiActions"><button className="outlineButton" onClick={()=>void save()}>บันทึก Draft</button><button className="gradientButton" disabled={!data?.draft} onClick={()=>void publish()}>Publish</button></div>
      </article>
    </div>

    <article className="aiCard">
      <h3>Test Playground — Published vs Draft</h3>
      <textarea className="aiTestInput" value={testText} onChange={e=>setTestText(e.target.value)}/>
      <div className="aiActions"><button className="outlineButton" onClick={()=>void runTest(false)}>ทดสอบ Published</button><button className="gradientButton" onClick={()=>void runTest(true)}>ทดสอบ Draft</button></div>
      <div className="aiTwoCol"><pre className="aiPromptPreview">{publishedTest?JSON.stringify(publishedTest,null,2):'Published result'}</pre><pre className="aiPromptPreview">{draftTest?JSON.stringify(draftTest,null,2):'Draft result'}</pre></div>
    </article>

    <article className="aiCard">
      <h3>Version History</h3>
      {data?.versions?.map(v=><div className="aiLine" key={v.id}><span>v{v.version} · {v.status} · {new Date(v.createdAt).toLocaleString('th-TH')}</span><button className="outlineButton" disabled={v.status==='published'} onClick={()=>void rollback(v.version)}>Rollback</button></div>)}
    </article>
    {message&&<p className="aiSaved">{message}</p>}
  </div>;
}
