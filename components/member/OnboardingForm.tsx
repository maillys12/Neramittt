'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabase/browser';

export default function OnboardingForm(){
  const router=useRouter();
  const[displayName,setDisplayName]=useState('');
  const[username,setUsername]=useState('');
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState('');

  async function submit(e:FormEvent){
    e.preventDefault(); setBusy(true); setError('');
    try{
      const supabase=getBrowserSupabase();
      const{data}=await supabase.auth.getSession();
      const token=data.session?.access_token;
      if(!token) return router.replace('/login');
      const r=await fetch('/api/member/profile',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({displayName,username})});
      const x=await r.json();
      if(!r.ok) throw new Error(String(x.error||'สร้างโปรไฟล์ไม่สำเร็จ').includes('USERNAME_TAKEN')?'Username นี้ถูกใช้แล้ว':x.error||'สร้างโปรไฟล์ไม่สำเร็จ');
      router.replace('/account');
    }catch(err){setError(err instanceof Error?err.message:'เกิดข้อผิดพลาด');}
    finally{setBusy(false);}
  }
  return <form className="memberAuthCard" onSubmit={submit}>
    <div className="memberAuthBrand">ยินดีต้อนรับสู่ Neramit</div>
    <h1>ตั้งค่าโปรไฟล์</h1>
    <p className="mutedText">ใช้เวลาไม่ถึงหนึ่งนาที และ Username จะเปลี่ยนไม่ได้ภายหลัง</p>
    <label>ชื่อที่แสดง<input required maxLength={80} value={displayName} onChange={e=>setDisplayName(e.target.value)}/></label>
    <label>Username<input required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" value={username} onChange={e=>setUsername(e.target.value.toLowerCase())}/><small>ใช้ a-z, 0-9 และ _ เท่านั้น</small></label>
    {error&&<p className="memberError">{error}</p>}
    <button className="gradientButton fullButton" disabled={busy}>{busy?'กำลังสร้างโปรไฟล์…':'เริ่มใช้งาน'}</button>
  </form>
}
