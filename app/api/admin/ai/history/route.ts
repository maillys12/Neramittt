import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin/auth';
import { getServerSupabase } from '@/lib/supabase/server';
export async function GET(req:Request){
  try{await requireAdmin(req);const u=new URL(req.url);const page=z.coerce.number().int().min(1).default(1).parse(u.searchParams.get('page')??1);const pageSize=z.coerce.number().int().min(1).max(100).default(30).parse(u.searchParams.get('pageSize')??30);const from=(page-1)*pageSize;const db=getServerSupabase();const{data,error,count}=await db.from('admin_audit_logs').select('*',{count:'exact'}).order('created_at',{ascending:false}).range(from,from+pageSize-1);if(error)throw error;return NextResponse.json({ok:true,items:data??[],page,pageSize,total:count??0});}
  catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'HISTORY_FAILED'},{status:400});}
}
