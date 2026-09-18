'use client';
import { useEffect,useState } from 'react';

type Audit={id:number;action:string;target_type:string|null;target_id:string|null;metadata:Record<string,unknown>;created_at:string};
type Notice={id:string;severity:string;source:string;title:string;message:string;read_at:string|null;created_at:string};

export default function AIHistoryTab({token}:{token:string}) {
  const [history,setHistory]=useState<Audit[]>([]);
  const [notices,setNotices]=useState<Notice[]>([]);

  async function load(){
    const [h,n]=await Promise.all([
      fetch('/api/admin/ai/history',{headers:{'x-neramit-admin':token}}),
      fetch('/api/admin/ai/notifications',{headers:{'x-neramit-admin':token}}),
    ]);
    const hx=await h.json(),nx=await n.json();
    if(h.ok)setHistory(hx.items);
    if(n.ok)setNotices(nx.notifications);
  }
  useEffect(()=>{void load();},[token]);

  async function mark(id:string,read:boolean){
    await fetch('/api/admin/ai/notifications',{method:'PATCH',headers:{'content-type':'application/json','x-neramit-admin':token},body:JSON.stringify({id,read})});
    void load();
  }

  return <div className="aiStack">
    <article className="aiCard">
      <h3>Admin Notifications</h3>
      {notices.length?notices.map(n=><div className={'aiNotice '+n.severity+(n.read_at?' read':'')} key={n.id}>
        <div><strong>{n.title}</strong><p>{n.message}</p><small>{new Date(n.created_at).toLocaleString('th-TH')} · {n.source}</small></div>
        <button className="outlineButton" onClick={()=>void mark(n.id,!n.read_at)}>{n.read_at?'ยังไม่อ่าน':'อ่านแล้ว'}</button>
      </div>):<p className="mutedText">ยังไม่มีแจ้งเตือน</p>}
    </article>

    <article className="aiCard">
      <h3>Audit History</h3>
      {history.length?history.map(item=><div className="aiAudit" key={item.id}>
        <div><strong>{item.action}</strong><span>{item.target_type||'system'} {item.target_id||''}</span><small>{new Date(item.created_at).toLocaleString('th-TH')}</small></div>
        <details><summary>รายละเอียด</summary><pre>{JSON.stringify(item.metadata,null,2)}</pre></details>
      </div>):<p className="mutedText">ยังไม่มีประวัติ</p>}
    </article>
  </div>;
}
