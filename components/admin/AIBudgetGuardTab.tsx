'use client';
import { useEffect,useState } from 'react';

type Budget={monthlyBudgetThb:number;billingPeriodAnchor:number;usedThb:number;remainingThb:number;usedPercent:number;usdToThb:number;enabled:boolean};
type Rule={id:string;enabled:boolean;priority:number;condition_metric:string;operator:string;threshold:number;action:string;action_config:Record<string,unknown>};

export default function AIBudgetGuardTab({token}:{token:string}) {
  const [budget,setBudget]=useState<Budget|null>(null);
  const [rules,setRules]=useState<Rule[]>([]);
  const [message,setMessage]=useState('');
  const [safeMode,setSafeMode]=useState(false);

  async function load(){
    const [b,r,m]=await Promise.all([
      fetch('/api/admin/ai/budget',{headers:{'x-neramit-admin':token}}),
      fetch('/api/admin/ai/budget-rules',{headers:{'x-neramit-admin':token}}),
      fetch('/api/admin/ai/models',{headers:{'x-neramit-admin':token}}),
    ]);
    const bx=await b.json(),rx=await r.json(),mx=await m.json();
    if(b.ok)setBudget(bx.budget);
    if(r.ok)setRules(rx.rules);
    if(m.ok)setSafeMode(Boolean(mx.config?.safeMode));
  }
  useEffect(()=>{void load();},[token]);

  async function saveBudget(){
    if(!budget)return;
    const r=await fetch('/api/admin/ai/budget',{method:'PATCH',headers:{'content-type':'application/json','x-neramit-admin':token},body:JSON.stringify({monthlyBudgetAmount:budget.monthlyBudgetThb,billingPeriodAnchor:budget.billingPeriodAnchor,enabled:budget.enabled,usdToThb:budget.usdToThb})});
    const x=await r.json();if(r.ok){setBudget(x.budget);setMessage('บันทึกงบแล้ว');}else setMessage(x.error||'บันทึกไม่สำเร็จ');
  }

  async function saveRule(rule:Rule){
    const r=await fetch('/api/admin/ai/budget-rules',{method:'PATCH',headers:{'content-type':'application/json','x-neramit-admin':token},body:JSON.stringify({id:rule.id,enabled:rule.enabled,priority:rule.priority,conditionMetric:rule.condition_metric,operator:rule.operator,threshold:Number(rule.threshold),action:rule.action,actionConfig:rule.action_config??{}})});
    const x=await r.json();setMessage(r.ok?'บันทึก Rule แล้ว':x.error||'บันทึก Rule ไม่สำเร็จ');if(r.ok)void load();
  }

  async function addRule(){
    const r=await fetch('/api/admin/ai/budget-rules',{method:'POST',headers:{'content-type':'application/json','x-neramit-admin':token},body:JSON.stringify({enabled:false,priority:100,conditionMetric:'budget_used_percent',operator:'gte',threshold:80,action:'notify_warning',actionConfig:{}})});
    if(r.ok)void load();
  }

  async function toggleSafe(){
    if(!window.confirm(safeMode?'ปิด Safe Mode?':'เปิด Safe Mode และบังคับใช้ known-good defaults?'))return;
    const r=await fetch('/api/admin/ai/safe-mode',{method:'POST',headers:{'content-type':'application/json','x-neramit-admin':token},body:JSON.stringify({enabled:!safeMode,confirm:true})});
    const x=await r.json();if(r.ok){setSafeMode(Boolean(x.safeMode));setMessage(x.safeMode?'Safe Mode เปิดแล้ว':'Safe Mode ปิดแล้ว');}
  }

  return <div className="aiStack">
    {safeMode&&<div className="safeModeBanner"><strong>SAFE MODE ACTIVE</strong><span>Database overrides ถูกข้ามอยู่</span></div>}

    <article className="aiCard">
      <div className="aiCardHead"><div><h3>Neramit AI Budget</h3><p>ใช้ไป ฿{budget?.usedThb.toFixed(2)??'—'} · เหลือ ฿{budget?.remainingThb.toFixed(2)??'—'}</p></div><button className={safeMode?'dangerButton':'outlineButton'} onClick={()=>void toggleSafe()}>{safeMode?'ปิด Safe Mode':'เปิด Safe Mode'}</button></div>
      {budget&&<div className="aiFormGrid">
        <label>งบต่อเดือน (บาท)<input type="number" min={0} value={budget.monthlyBudgetThb} onChange={e=>setBudget({...budget,monthlyBudgetThb:Number(e.target.value)})}/></label>
        <label>วันเริ่มรอบบิล<input type="number" min={1} max={28} value={budget.billingPeriodAnchor} onChange={e=>setBudget({...budget,billingPeriodAnchor:Number(e.target.value)})}/></label>
        <label>USD → THB snapshot<input type="number" min={1} step="0.01" value={budget.usdToThb} onChange={e=>setBudget({...budget,usdToThb:Number(e.target.value)})}/></label>
        <label className="aiCheck"><input type="checkbox" checked={budget.enabled} onChange={e=>setBudget({...budget,enabled:e.target.checked})}/> เปิดใช้ Budget</label>
      </div>}
      <button className="gradientButton" onClick={()=>void saveBudget()}>บันทึกงบ</button>
    </article>

    <article className="aiCard">
      <div className="aiCardHead"><div><h3>Budget Guard Rules</h3><p>กำหนด threshold และ action ได้เอง</p></div><button className="outlineButton" onClick={()=>void addRule()}>+ เพิ่ม Rule</button></div>
      {rules.map((rule,i)=><RuleEditor key={rule.id} rule={rule} onChange={next=>setRules(v=>v.map((x,n)=>n===i?next:x))} onSave={saveRule}/>)}
    </article>
    {message&&<p className="aiSaved">{message}</p>}
  </div>;
}

function RuleEditor({rule,onChange,onSave}:{rule:Rule;onChange:(r:Rule)=>void;onSave:(r:Rule)=>void}) {
  return <div className="aiRule">
    <label className="aiCheck"><input type="checkbox" checked={rule.enabled} onChange={e=>onChange({...rule,enabled:e.target.checked})}/> เปิด</label>
    <select value={rule.condition_metric} onChange={e=>onChange({...rule,condition_metric:e.target.value})}><option value="budget_used_percent">Budget used %</option><option value="budget_remaining_thb">Budget remaining THB</option><option value="daily_cost_thb">Daily cost THB</option><option value="monthly_cost_thb">Monthly cost THB</option></select>
    <select value={rule.operator} onChange={e=>onChange({...rule,operator:e.target.value})}><option value="gte">≥</option><option value="lte">≤</option><option value="gt">&gt;</option><option value="lt">&lt;</option></select>
    <input type="number" title="Priority" aria-label="Priority" value={rule.priority} onChange={e=>onChange({...rule,priority:Number(e.target.value)})}/>
    <input type="number" title="Threshold" aria-label="Threshold" value={rule.threshold} onChange={e=>onChange({...rule,threshold:Number(e.target.value)})}/>
    <select value={rule.action} onChange={e=>onChange({...rule,action:e.target.value,action_config:{}})}><option value="notify_warning">แจ้งเตือน Warning</option><option value="notify_critical">แจ้งเตือน Critical</option><option value="cost_saver">Cost Saver</option><option value="reduce_reasoning">ลด Reasoning</option><option value="force_model">บังคับ Model</option><option value="disable_stage">ปิด Stage</option><option value="pause_ai">Pause AI</option></select>
    {rule.action==='force_model'&&<select value={String(rule.action_config.model??'gpt-5.6-luna')} onChange={e=>onChange({...rule,action_config:{model:e.target.value}})}><option>gpt-5.6-luna</option><option>gpt-5.6-terra</option><option>gpt-5.6-sol</option><option>gpt-5.6</option></select>}
    {rule.action==='reduce_reasoning'&&<select value={String(rule.action_config.effort??'low')} onChange={e=>onChange({...rule,action_config:{effort:e.target.value}})}><option>none</option><option>low</option><option>medium</option></select>}
    {rule.action==='disable_stage'&&<select value={String(rule.action_config.stage??'research')} onChange={e=>onChange({...rule,action_config:{stage:e.target.value}})}><option>requirement</option><option>research</option><option>creative_director</option><option>final_prompt</option><option>repair</option></select>}
    <button className="outlineButton" onClick={()=>onSave(rule)}>บันทึก</button>
  </div>;
}
