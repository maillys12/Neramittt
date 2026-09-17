import ChatClient from '@/components/ChatClient';
import { AppHeader } from '@/components/ui/AppHeader';

export default function Chat(){
  return <main className="siteShell innerPage">
    <AppHeader quota="10 ครั้งวันนี้" />
    <section className="pageIntro pageIntro--compact"><span className="pageMascot">✏️</span><div><h1>คุยกับ<span className="gradientText">เนรมิต</span></h1><p>เล่าไอเดียของคุณ แล้วเราช่วยต่อยอดทีละขั้น</p></div></section>
    <ChatClient/>
  </main>
}
