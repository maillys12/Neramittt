'use client';
import { useEffect,useState } from 'react';

type Overview = {
  budget:{monthlyBudgetThb:number;usedThb:number;remainingThb:number;usedPercent:number;periodStart:string;periodEnd:string};
  providerBilling:{available:boolean;costUsd?:number;creditBalanceUsd?:number;reason?:string;asOf:string};
  today:{costThb:number;creditUsedThb:number;requests:number;inputTokens:number;outputTokens:number};
  month:{costThb:number;creditUsedThb:number;requests:number;inputTokens:number;outputTokens:number};
  unreadNotifications:number;
  runtime:{safeMode:boolean;autoRoutingEnabled:boolean;operatingMode:string};
  publishedPrompts:{system:number|null;creativeDirector:number|null};
};

const money=(n:number)=>new Intl.NumberFormat('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);

export default function AIOverviewTab({token}:{token:string}) {
  const [data,setData]=useState<Overview|null>(null);
  const [error,setError]=useState('');

  async function load() {
    setError('');
    const r=await fetch('/api/admin/ai/overview',{headers:{'x-neramit-admin':token}});
    const x=await r.json();
    if(!r.ok){setError(x.error||'โหลดข้อมูลไม่สำเร็จ');return;}
    setData(x);
  }

  useEffect(()=>{void load();},[token]);

  if(error)return <div className="aiEmpty error">{error}</div>;
  if(!data)return <div className="aiEmpty">กำลังโหลดข้อมูล AI…</div>;
  const percent=Math.min(100,Math.max(0,data.budget.usedPercent));
  const systemLabel=data.publishedPrompts.system?'v'+data.publishedPrompts.system:'ใช้ค่าในโค้ด';
  const creativeLabel=data.publishedPrompts.creativeDirector?'v'+data.publishedPrompts.creativeDirector:'ใช้ค่าในโค้ด';

  return <div className="aiStack">
    {data.runtime.safeMode&&<div className="safeModeBanner"><strong>SAFE MODE ACTIVE</strong><span>ระบบกำลังใช้ค่า known-good จากโค้ดและข้าม overrides</span></div>}
    <div className="aiMetricGrid">
      <article><small>ค่าใช้จ่ายวันนี้</small><strong>฿{money(data.today.costThb)}</strong><span>{data.today.requests} requests</span></article>
      <article><small>เครดิตที่ใช้เดือนนี้</small><strong>฿{money(data.month.creditUsedThb)}</strong><span>{(data.month.inputTokens+data.month.outputTokens).toLocaleString()} tokens</span></article>
      <article><small>งบ Neramit คงเหลือ</small><strong>฿{money(data.budget.remainingThb)}</strong><span>{data.budget.usedPercent.toFixed(1)}% used</span></article>
      <article><small>แจ้งเตือนที่ยังไม่อ่าน</small><strong>{data.unreadNotifications}</strong><span>{data.runtime.autoRoutingEnabled?'Auto Routing เปิด':'Auto Routing ปิด'}</span></article>
    </div>

    <article className="aiCard">
      <div className="aiCardHead"><div><h3>Neramit AI Budget</h3><p>฿{money(data.budget.usedThb)} / ฿{money(data.budget.monthlyBudgetThb)}</p></div><b>{data.budget.usedPercent.toFixed(1)}%</b></div>
      <div className="aiProgress"><i style={{width:String(percent)+'%'}}/></div>
      <div className="aiMeta"><span>รอบบิล {new Date(data.budget.periodStart).toLocaleDateString('th-TH')} – {new Date(data.budget.periodEnd).toLocaleDateString('th-TH')}</span></div>
    </article>

    <div className="aiTwoCol">
      <article className="aiCard">
        <h3>OpenAI Account</h3>
        {data.providerBilling.available?
          <><p>ค่าใช้จ่ายที่ provider รายงาน: <strong>{'$'}{money(data.providerBilling.costUsd??0)}</strong></p><p>เครดิตคงเหลือ: <strong>{data.providerBilling.creditBalanceUsd===undefined?'API ไม่ได้ให้ยอดนี้':'$'+money(data.providerBilling.creditBalanceUsd)}</strong></p></>
          :<><p className="mutedText">ยอดเครดิตจริงยังดึงผ่าน API ไม่ได้</p><small>สถานะ: {data.providerBilling.reason}</small></>}
      </article>
      <article className="aiCard">
        <h3>Production AI</h3>
        <p>System Prompt: <strong>{systemLabel}</strong></p>
        <p>Creative Director: <strong>{creativeLabel}</strong></p><p>Operating Mode: <strong>{data.runtime.operatingMode}</strong></p>
        <button className="outlineButton" onClick={()=>void load()}>รีเฟรช</button>
      </article>
    </div>
  </div>;
}
