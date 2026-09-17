import AdminClient from'@/components/AdminClient';import{BrandMark}from'@/components/ui/BrandMark';
export default function Admin(){return <main className="siteShell adminPage"><header className="adminHeader"><BrandMark compact/><span className="adminBadge">ADMIN</span><span className="ownerBadge">🔒 สำหรับเจ้าของระบบ</span></header><AdminClient/></main>}
