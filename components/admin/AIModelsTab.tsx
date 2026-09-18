'use client';
import { useEffect,useState } from 'react';

type Stage = {stage:string;mode:'auto'|'manual';modelOverride:string|null;fallbackModel:string;reasoningEffort:string;maxOutputTokens:number};
type Config = {safeMode:boolean;autoRoutingEnabled:boolean;stages:Record<string,Stage>};

export default function AIModelsTab({token}:{token:string}) {
  const [config,setConfig]=useState<Config|null>(null);
  const [models,setModels]=useState<string[]>([]);
  const [efforts,setEfforts]=useState<string[]>([]);
  const [message,setMessage]=useState('');

  async function load(){
    const r=await fetch('/api/admin/ai/models',{headers:{'x-neramit-admin':token}});
    const x=await r.json();
    if(r.ok){setConfig(x.config);setModels(x.allowedModels);setEfforts(x.reasoningEfforts);}
  }
  useEffect(()=>{void load();},[token]);

  async function saveStage(stage:Stage){
    if(!window.confirm('ยืนยันใช้การตั้งค่านี้กับระบบ AI?'))return;
    const r=await fetch('/api/admin/ai/models',{method:'PATCH',headers:{'content-type':'application/json','x-neramit-admin':token},body:JSON.stringify({stage})});
    const x=await r.json();
    if(r.ok){setConfig(x.config);setMessage('บันทึกแล้ว');}else setMessage(x.error||'บันทึกไม่สำเร็จ');
  }

  async function toggleAuto(){
    if(!config)return;
    const r=await fetch('/api/admin/ai/models',{method:'PATCH',headers:{'content-type':'application/json','x-neramit-admin':token},body:JSON.stringify({autoRoutingEnabled:!config.autoRoutingEnabled})});
    const x=await r.json();
    if(r.ok)setConfig(x.config);
  }

  if(!config)return <div className="aiEmpty">กำลังโหลด Model Control…</div>;

  return <div className="aiStack">
    <article className="aiCard aiCardHead">
      <div><h3>Auto Model Routing</h3><p>ระบบเลือกโมเดลตาม stage และใช้ Manual Override เมื่อกำหนด</p></div>
      <button className={config.autoRoutingEnabled?'gradientButton':'outlineButton'} onClick={()=>void toggleAuto()}>{config.autoRoutingEnabled?'เปิดอยู่':'ปิดอยู่'}</button>
    </article>
    {config.safeMode&&<div className="safeModeBanner"><strong>Safe Mode กำลัง override ค่าด้านล่างทั้งหมด</strong></div>}
    <div className="aiStageList">
      {Object.values(config.stages).map(stage=><StageEditor key={stage.stage} stage={stage} models={models} efforts={efforts} onSave={saveStage}/>)}
    </div>
    {message&&<p className="aiSaved">{message}</p>}
  </div>;
}

function StageEditor({stage,models,efforts,onSave}:{stage:Stage;models:string[];efforts:string[];onSave:(s:Stage)=>void}) {
  const [value,setValue]=useState(stage);
  useEffect(()=>setValue(stage),[stage]);
  const selected=value.modelOverride??models[0]??'';

  return <article className="aiCard">
    <div className="aiCardHead">
      <div><h3>{value.stage}</h3><p>{value.mode==='auto'?'ใช้ Auto Routing':'Manual Override'}</p></div>
      <select value={value.mode} onChange={e=>setValue({...value,mode:e.target.value as Stage['mode']})}><option value="auto">Auto</option><option value="manual">Manual</option></select>
    </div>
    <div className="aiFormGrid">
      <label>Model<select disabled={value.mode==='auto'} value={selected} onChange={e=>setValue({...value,modelOverride:e.target.value})}>{models.map(m=><option key={m} value={m}>{m}</option>)}</select></label>
      <label>Fallback<select value={value.fallbackModel} onChange={e=>setValue({...value,fallbackModel:e.target.value})}>{models.map(m=><option key={m} value={m}>{m}</option>)}</select></label>
      <label>Reasoning<select value={value.reasoningEffort} onChange={e=>setValue({...value,reasoningEffort:e.target.value})}>{efforts.map(v=><option key={v} value={v}>{v}</option>)}</select></label>
      <label>Max output tokens<input type="number" min={128} max={128000} value={value.maxOutputTokens} onChange={e=>setValue({...value,maxOutputTokens:Number(e.target.value)})}/></label>
    </div>
    <div className="aiActions"><button className="outlineButton" onClick={()=>setValue({...value,mode:'auto',modelOverride:null})}>Reset to Auto</button><button className="gradientButton" onClick={()=>onSave(value)}>บันทึก</button></div>
  </article>;
}
