'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getBrowserSupabase } from '@/lib/supabase/browser';

type Mode = 'login' | 'signup' | 'forgot' | 'reset';

export default function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(''); setMessage('');
    const supabase = getBrowserSupabase();
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error('ไม่พบเซสชัน');
        const profile = await fetch('/api/member/profile', { headers: { authorization: `Bearer ${token}` } }).then(r => r.json());
        router.replace(profile.profile?.onboarding_completed ? '/account' : '/onboarding');
      } else if (mode === 'signup') {
        if (password !== confirm) throw new Error('รหัสผ่านไม่ตรงกัน');
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) {
          setMessage('สร้างบัญชีแล้ว แต่โครงการ Supabase ยังเปิดการยืนยันอีเมลอยู่ กรุณาปิด Confirm email ใน Auth settings เพื่อให้เข้าใช้ได้ทันที');
          return;
        }
        router.replace('/onboarding');
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/reset-password` });
        if (error) throw error;
        setMessage('ส่งลิงก์รีเซ็ตรหัสผ่านแล้ว กรุณาตรวจอีเมล');
      } else {
        if (password !== confirm) throw new Error('รหัสผ่านไม่ตรงกัน');
        if (password.length < 8) throw new Error('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        await supabase.auth.signOut({ scope: 'global' });
        router.replace('/login?password=changed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setBusy(false);
    }
  }

  const title = mode === 'login' ? 'เข้าสู่ระบบ' : mode === 'signup' ? 'สมัครสมาชิก' : mode === 'forgot' ? 'ลืมรหัสผ่าน' : 'ตั้งรหัสผ่านใหม่';
  return <form className="memberAuthCard" onSubmit={submit}>
    <div className="memberAuthBrand">Neramit</div>
    <h1>{title}</h1>
    {mode !== 'reset' && <label>อีเมล<input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email"/></label>}
    {mode !== 'forgot' && <label>{mode === 'reset' ? 'รหัสผ่านใหม่' : 'รหัสผ่าน'}<input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'}/></label>}
    {(mode === 'signup' || mode === 'reset') && <label>ยืนยันรหัสผ่าน<input type="password" required minLength={8} value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password"/></label>}
    {error && <p className="memberError">{error}</p>}
    {message && <p className="memberSuccess">{message}</p>}
    <button className="gradientButton fullButton" disabled={busy}>{busy ? 'กำลังดำเนินการ…' : title}</button>
    <div className="memberAuthLinks">
      {mode === 'login' && <><Link href="/forgot-password">ลืมรหัสผ่าน?</Link><Link href="/signup">ยังไม่มีบัญชี สมัครสมาชิก</Link></>}
      {mode === 'signup' && <Link href="/login">มีบัญชีแล้ว เข้าสู่ระบบ</Link>}
      {mode === 'forgot' && <Link href="/login">กลับไปเข้าสู่ระบบ</Link>}
    </div>
  </form>;
}
