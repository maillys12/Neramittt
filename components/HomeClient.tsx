'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getOrCreateDeviceToken } from '@/lib/device/token';
import { AppHeader } from '@/components/ui/AppHeader';

export default function HomeClient(){
  const[quota,setQuota]=useState('…');
  useEffect(()=>{const token=getOrCreateDeviceToken();fetch('/api/device',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token})}).then(r=>r.json()).then(x=>{if(!x.ok)return setQuota('—');const used=(x.used??0)+(x.reserved??0);setQuota(`${Math.max(0,(x.limit??10)-used)} ครั้งวันนี้`)}).catch(()=>setQuota('—'));},[]);
  return <main className="siteShell homePage">
    <AppHeader quota={quota}/>
    <section className="heroShowcase">
      <div className="heroCopy">
        <span className="heroNote">ไอเดีย + พรอมต์ = ผลงานใหม่ ✦</span>
        <h1>สร้างพรอมต์ดี ๆ<br/><span className="gradientText">ได้ง่ายกว่าที่คิด</span></h1>
        <p>เปลี่ยนไอเดียของคุณให้เป็นพรอมต์ภาพและโปสเตอร์ที่พร้อมใช้กับ AI ที่คุณเลือก</p>
      </div>
      <div className="heroMascot" aria-hidden="true"><span className="spark s1">✦</span><div className="pencilMascot">✏️</div><span className="spark s2">✦</span><small>จินตนาการ<br/>สร้างได้จริง ๆ นะ!</small></div>
    </section>
    <section className="homeActions" aria-label="เริ่มสร้างพรอมต์">
      <article className="actionCard actionCard--chat"><div className="actionIcon">💬</div><div><h2>คุยกับ AI</h2><p>ให้เนรมิตช่วยถามและคิดทีละขั้น</p><Link className="gradientButton" href="/chat">เริ่มคุยกับเนรมิต <span>→</span></Link></div></article>
      <article className="actionCard actionCard--form"><div className="actionIcon">📝</div><div><h2>แบบฟอร์มด่วน</h2><p>กรอกรายละเอียดทั้งหมดแล้วสร้างทันที</p><Link className="gradientButton gradientButton--pink" href="/form">เริ่มกรอกแบบฟอร์ม <span>→</span></Link></div></article>
    </section>
    <section className="platformStrip" aria-label="รูปแบบพรอมต์ที่รองรับ"><span>รองรับ</span><b>◉ ChatGPT</b><b>✦ Gemini</b><b>◉ Canva AI</b><b>▱ พรอมต์กลาง</b></section>
    <p className="homeFoot">✦ สร้างสรรค์ได้ไกลกว่าเดิม เริ่มเลยกับเนรมิต ✦</p>
  </main>
}
