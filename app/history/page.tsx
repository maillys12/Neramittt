import HistoryClient from'@/components/HistoryClient';import{AppHeader}from'@/components/ui/AppHeader';
export default function History(){return <main className="siteShell innerPage"><AppHeader active="history"/><section className="pageIntro"><span className="pageMascot">📝</span><div><h1>ประวัติของฉัน</h1><p>กลับมาเปิดไอเดียเดิม แล้วต่อยอดได้ทุกเมื่อ</p></div></section><HistoryClient/></main>}
