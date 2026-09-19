'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabase/browser';

const nav = [
  ['/account','แดชบอร์ด'], ['/account/creations','ผลงานของฉัน'], ['/account/plans','แพ็กเกจและเครดิต'],
  ['/account/orders','รายการสั่งซื้อ'], ['/account/notifications','การแจ้งเตือน'], ['/account/profile','โปรไฟล์'], ['/account/security','ความปลอดภัย'],
] as const;

export default function MemberShell({ children }: { children: React.ReactNode }) {
  const path=usePathname(); const router=useRouter();
  async function logout(){await getBrowserSupabase().auth.signOut();router.replace('/login')}
  return <div className="memberArea"><aside className="memberSidebar"><Link href="/" className="memberLogo">Neramit</Link><nav>{nav.map(([href,label])=><Link key={href} className={path===href?'active':''} href={href}>{label}</Link>)}</nav><button onClick={logout}>ออกจากระบบ</button></aside><main className="memberContent">{children}</main></div>
}
