import ChatClient from '@/components/ChatClient';
import { AppHeader } from '@/components/ui/AppHeader';
import { NeramitIcon } from '@/components/ui/NeramitIcon';

export default function Chat(){
  return <main className="siteShell innerPage">
    <AppHeader />
    <section className="pageIntro pageIntro--compact"><span className="pageMascot pageMascot--vector"><NeramitIcon name="chat" size={30}/></span><div><h1>คุยกับ<span className="gradientText">เนรมิต</span></h1><p>เล่าไอเดียของคุณ แล้วเราช่วยต่อยอดทีละขั้น</p></div></section>
    <ChatClient/>
  </main>
}
