'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getOrCreateDeviceToken } from '@/lib/device/token';
import { AppHeader } from '@/components/ui/AppHeader';
import { NeramitIcon } from '@/components/ui/NeramitIcon';
import { NeramitMascot } from '@/components/ui/NeramitMascot';

export default function HomeClient(){
  const[quota,setQuota]=useState('…');
  useEffect(()=>{const token=getOrCreateDeviceToken();fetch('/api/device',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token})}).then(r=>r.json()).then(x=>{if(!x.ok)return setQuota('—');const used=(x.used??0)+(x.reserved??0);setQuota(`${Math.max(0,(x.limit??10)-used)} ครั้งวันนี้`)}).catch(()=>setQuota('—'));},[]);
  return <main className="siteShell homePage">
    <AppHeader quota={quota}/>
    <section className="heroShowcase">
      <div className="heroCopy">
        <span className="heroNote">ไอเดีย + พรอมต์ = ผลงานใหม่</span>
        <h1>สร้างพรอมต์ดี ๆ<br/><span className="gradientText">ได้ง่ายกว่าที่คิด</span></h1>
        <p>เปลี่ยนไอเดียของคุณให้เป็นพรอมต์ภาพและโปสเตอร์ที่พร้อมใช้กับ AI ที่คุณเลือก</p>
      </div>
      <div className="heroMascot" aria-hidden="true"><span className="spark s1"><NeramitIcon name="spark" size={28}/></span><NeramitMascot size={120} className="pencilMascotSvg"/><span className="spark s2"><NeramitIcon name="spark" size={24}/></span><small>จินตนาการ<br/>สร้างได้จริง ๆ นะ!</small></div>
    </section>
    <section className="homeActions" aria-label="เริ่มสร้างพรอมต์">
      <article className="actionCard actionCard--chat"><div className="actionIcon actionIcon--vector"><NeramitIcon name="chat" size={58}/></div><div><h2>คุยกับ AI</h2><p>ให้เนรมิตช่วยถามและคิดทีละขั้น</p><Link className="gradientButton" href="/chat">เริ่มคุยกับเนรมิต <NeramitIcon name="chevronRight" size={18}/></Link></div></article>
      <article className="actionCard actionCard--form"><div className="actionIcon actionIcon--vector"><NeramitIcon name="document" size={58}/></div><div><h2>แบบฟอร์มด่วน</h2><p>กรอกรายละเอียดทั้งหมดแล้วสร้างทันที</p><Link className="gradientButton gradientButton--pink" href="/form">เริ่มกรอกแบบฟอร์ม <NeramitIcon name="chevronRight" size={18}/></Link></div></article>
    </section>
    <section className="platformStrip" aria-label="รูปแบบพรอมต์ที่รองรับ"><span>รองรับ</span><b><NeramitIcon name="spark" size={15}/>ChatGPT</b><b><NeramitIcon name="spark" size={15}/>Gemini</b><b><NeramitIcon name="palette" size={15}/>Canva AI</b><b><NeramitIcon name="layers" size={15}/>พรอมต์กลาง</b></section>
    <p className="homeFoot">สร้างสรรค์ได้ไกลกว่าเดิม เริ่มเลยกับเนรมิต</p>
  </main>
}
