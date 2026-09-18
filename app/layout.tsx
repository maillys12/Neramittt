import type { Metadata } from 'next';
import './globals.css';
import './ui-overhaul.css';
import './interaction.css';
import './chat-polish.css';
import './member.css';

export const metadata:Metadata={title:'Neramit — สร้างพรอมต์ได้ง่ายกว่าที่คิด',description:'ผู้ช่วยสร้างพรอมต์สำหรับภาพและโปสเตอร์'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="th"><body>{children}</body></html>}
