'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getOrCreateDeviceToken } from '@/lib/device/token';
import { BrandMark } from './BrandMark';

type Props = { quota?: string; active?: 'create'|'history'|'admin' };

export function AppHeader({ quota, active = 'create' }: Props) {
  const [open, setOpen] = useState(false);
  const [resolvedQuota, setResolvedQuota] = useState(quota ?? '…');

  useEffect(() => {
    if (quota) {
      setResolvedQuota(quota);
      return;
    }
    const token = getOrCreateDeviceToken();
    fetch('/api/device', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(r => r.json())
      .then(x => {
        if (!x.ok) return setResolvedQuota('—');
        const used = (x.used ?? 0) + (x.reserved ?? 0);
        setResolvedQuota(`${Math.max(0, (x.limit ?? 10) - used)} ครั้งวันนี้`);
      })
      .catch(() => setResolvedQuota('—'));
  }, [quota]);

  return (
    <header className="appHeader">
      <BrandMark compact />
      <nav className={`appNav${open ? ' isOpen' : ''}`} aria-label="เมนูหลัก">
        <Link className={active==='create'?'active':''} href="/">สร้างพรอมต์</Link>
        <Link className={active==='history'?'active':''} href="/history">ประวัติของฉัน</Link>
        <a href="#how">วิธีใช้งาน</a>
      </nav>
      <div className="headerActions">
        <span className="quotaPill" aria-label={`โควตาคงเหลือ ${resolvedQuota}`}><b>⚡</b> เหลือ {resolvedQuota}</span>
        <button className="menuButton" aria-label="เปิดเมนู" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>☰</button>
      </div>
    </header>
  );
}
