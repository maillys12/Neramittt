import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin/auth';
import { getServerSupabase } from '@/lib/supabase/server';
export async function GET(req:Request){try{await requireAdmin(req);const db=getServerSupabase();const{data,error}=await db.from('admin_notifications').select('*').order('created_at',{ascending:false}).limit(100);if(error)throw error;return NextResponse.json({ok:true,notifications:data??[]});}catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'NOTIFICATIONS_FAILED'},{status:401});}}
export async function PATCH(req:Request){try{await requireAdmin(req);const body=z.object({id:z.string().uuid(),read:z.boolean()}).parse(await req.json());const db=getServerSupabase();const{error}=await db.from('admin_notifications').update({read_at:body.read?new Date().toISOString():null}).eq('id',body.id);if(error)throw error;return NextResponse.json({ok:true});}catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'NOTIFICATIONS_FAILED'},{status:400});}}
