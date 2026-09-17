'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BrandMark } from './BrandMark';

type Props = { quota?: string; active?: 'create'|'history'|'admin' };

export function AppHeader({ quota = '…', active = 'create' }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <header className="appHeader">
      <BrandMark compact />
      <nav className={`appNav${open ? ' isOpen' : ''}`} aria-label="เมนูหลัก">
        <Link className={active==='create'?'active':''} href="/">สร้างพรอมต์</Link>
        <Link className={active==='history'?'active':''} href="/history">ประวัติของฉัน</Link>
        <a href="#how">วิธีใช้งาน</a>
      </nav>
      <div className="headerActions">
        <span className="quotaPill" aria-label={`โควตาคงเหลือ ${quota}`}><b>⚡</b> เหลือ {quota}</span>
        <button className="menuButton" aria-label="เปิดเมนู" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>☰</button>
      </div>
    </header>
  );
}
