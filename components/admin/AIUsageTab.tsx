'use client';
import { useEffect,useState } from 'react';

type Usage = {
  totals:{costUsd:number;costThb:number;requests:number;inputTokens:number;outputTokens:number;cachedTokens:number;toolCalls:number;errors:number};
  byModel:Record<string,{costThb:number;requests:number}>;
  byStage:Record<string,{costThb:number;requests:number}>;
  series:Array<{date:string;costThb:number;requests:number;tokens:number}>;
  recent:Array<Record<string,unknown>>;
};

const money=(n:number)=>new Intl.NumberFormat('th-TH',{maximumFractionDigits:4}).format(n);

export default function AIUsageTab({token}:{token:string}) {
  const [range,setRange]=useState('30d');
  const [metric,setMetric]=useState<'cost'|'credit'|'tokens'|'requests'>('cost');
  const [customFrom,setCustomFrom]=useState('');
  const [customTo,setCustomTo]=useState('');
  const [includeTests,setIncludeTests]=useState(false);
  const [data,setData]=useState<Usage|null>(null);

  async function load() {
    let url='/api/admin/ai/usage?range='+encodeURIComponent(range)+'&includeTests='+(includeTests?'true':'false');
    if(range==='custom'&&customFrom&&customTo){url+='&from='+encodeURIComponent(new Date(customFrom).toISOString())+'&to='+encodeURIComponent(new Date(customTo).toISOString());}
    const r=await fetch(url,{headers:{'x-neramit-admin':token}});
    const x=await r.json();
    if(r.ok)setData(x);
  }
  useEffect(()=>{if(range!=='custom'||(customFrom&&customTo))void load();},[range,includeTests,token,customFrom,customTo]);

  const values=(data?.series??[]).map(x=>(metric==='cost'||metric==='credit')?x.costThb:metric==='tokens'?x.tokens:x.requests);
  const max=Math.max(1,...values);

  return <div className="aiStack">
    <div className="aiToolbar">
      <select value={range} onChange={e=>setRange(e.target.value)}>
        <option value="today">วันนี้</option><option value="7d">7 วัน</option><option value="30d">30 วัน</option><option value="month">เดือนนี้</option><option value="billing">รอบบิลปัจจุบัน</option><option value="all">ทั้งหมด</option><option value="custom">กำหนดเอง</option>
      </select>
      <select value={metric} onChange={e=>setMetric(e.target.value as typeof metric)}>
        <option value="cost">Cost</option><option value="credit">Credit Used</option><option value="tokens">Tokens</option><option value="requests">Requests</option>
      </select>
      {range==='custom'&&<><input type="datetime-local" value={customFrom} onChange={e=>setCustomFrom(e.target.value)}/><input type="datetime-local" value={customTo} onChange={e=>setCustomTo(e.target.value)}/></>}
      <label className="aiCheck"><input type="checkbox" checked={includeTests} onChange={e=>setIncludeTests(e.target.checked)}/>รวม Draft Test</label>
    </div>

    {!data?<div className="aiEmpty">กำลังโหลด…</div>:<>
      <div className="aiMetricGrid">
        <article><small>Cost</small><strong>฿{money(data.totals.costThb)}</strong><span>{'$'}{money(data.totals.costUsd)}</span></article>
        <article><small>Credit Used</small><strong>฿{money(data.totals.costThb)}</strong><span>ภายใน Neramit</span></article>
        <article><small>Tokens</small><strong>{(data.totals.inputTokens+data.totals.outputTokens).toLocaleString()}</strong><span>cached {data.totals.cachedTokens.toLocaleString()}</span></article>
        <article><small>Requests</small><strong>{data.totals.requests}</strong><span>{data.totals.errors} errors · {data.totals.toolCalls} tool calls</span></article>
      </div>

      <article className="aiCard">
        <h3>แนวโน้มการใช้งาน</h3>
        <div className="aiBars">
          {data.series.length?data.series.map(p=>{
            const value=(metric==='cost'||metric==='credit')?p.costThb:metric==='tokens'?p.tokens:p.requests;
            return <div className="aiBar" key={p.date} title={p.date+': '+value}><i style={{height:String(Math.max(3,value/max*100))+'%'}}/><small>{p.date.slice(5)}</small></div>;
          }):<p className="mutedText">ยังไม่มีข้อมูล</p>}
        </div>
      </article>

      <div className="aiTwoCol">
        <article className="aiCard"><h3>ตาม Model</h3>{Object.entries(data.byModel).map(([k,v])=><div className="aiLine" key={k}><span>{k}</span><b>฿{money(v.costThb)} · {v.requests}</b></div>)}</article>
        <article className="aiCard"><h3>ตาม Stage</h3>{Object.entries(data.byStage).map(([k,v])=><div className="aiLine" key={k}><span>{k}</span><b>฿{money(v.costThb)} · {v.requests}</b></div>)}</article>
      </div>

      <article className="aiCard">
        <h3>Requests ล่าสุด</h3>
        <div className="aiTableWrap"><table className="aiTable"><thead><tr><th>เวลา</th><th>Stage</th><th>Model</th><th>Tokens</th><th>Cost</th><th>Status</th></tr></thead><tbody>
          {data.recent.slice(0,40).map((r,i)=><tr key={i}><td>{new Date(String(r.created_at)).toLocaleString('th-TH')}</td><td>{String(r.stage)}</td><td>{String(r.model)}</td><td>{Number(r.input_tokens??0)+Number(r.output_tokens??0)}</td><td>฿{money(Number(r.estimated_cost_thb??0))}</td><td>{String(r.status)}</td></tr>)}
        </tbody></table></div>
      </article>
    </>}
  </div>;
}
