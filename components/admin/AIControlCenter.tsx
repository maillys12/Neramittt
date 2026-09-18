'use client';
import { useEffect,useState } from 'react';
import AIOverviewTab from '@/components/admin/AIOverviewTab';
import AIUsageTab from '@/components/admin/AIUsageTab';
import AIModelsTab from '@/components/admin/AIModelsTab';
import AIPromptsTab from '@/components/admin/AIPromptsTab';
import AIBudgetGuardTab from '@/components/admin/AIBudgetGuardTab';
import AIHistoryTab from '@/components/admin/AIHistoryTab';

export const AI_CONTROL_TABS = [
  ['overview','Overview'],['usage','Usage & Cost'],['models','Models'],['prompts','Prompts'],['budget','Budget Guard'],['history','History'],
] as const;
type Tab = typeof AI_CONTROL_TABS[number][0];

export default function AIControlCenter({token}:{token:string}) {
  const [tab,setTab]=useState<Tab>('overview');
  const [unread,setUnread]=useState(0);

  async function refreshUnread(){
    const r=await fetch('/api/admin/ai/overview',{headers:{'x-neramit-admin':token}});
    const x=await r.json();
    if(r.ok)setUnread(Number(x.unreadNotifications??0));
  }
  useEffect(()=>{void refreshUnread();},[token,tab]);

  return <section className="aiControlCenter">
    <div className="aiControlHeader"><div><small className="aiEyebrow">AI CONTROL CENTER</small><h2>ควบคุมและติดตามระบบ AI</h2><p>ค่าใช้จ่าย เครดิต โมเดล พรอมต์ Budget Guard และประวัติการเปลี่ยนแปลง</p></div></div>
    <div className="aiTabs" role="tablist" aria-label="AI Control Center">
      {AI_CONTROL_TABS.map(([id,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}{id==='history'&&unread>0?<span className="aiTabBadge">{unread>99?'99+':unread}</span>:null}</button>)}
    </div>
    <div className="aiTabPanel">
      {tab==='overview'&&<AIOverviewTab token={token}/>}
      {tab==='usage'&&<AIUsageTab token={token}/>}
      {tab==='models'&&<AIModelsTab token={token}/>}
      {tab==='prompts'&&<AIPromptsTab token={token}/>}
      {tab==='budget'&&<AIBudgetGuardTab token={token}/>}
      {tab==='history'&&<AIHistoryTab token={token}/>}
    </div>
  </section>;
}
