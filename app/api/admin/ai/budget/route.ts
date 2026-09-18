import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { getBudgetSnapshot } from '@/lib/ai/budget';
import { writeAdminAudit } from '@/lib/admin/audit';
const Body=z.object({monthlyBudgetAmount:z.number().min(0).max(10000000),billingPeriodAnchor:z.number().int().min(1).max(28),enabled:z.boolean(),usdToThb:z.number().positive().max(1000)});
export async function GET(req:Request){try{await requireAdmin(req);return NextResponse.json({ok:true,budget:await getBudgetSnapshot()});}catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'ADMIN_AI_BUDGET_FAILED'},{status:401});}}
export async function PATCH(req:Request){
  try{
    await requireAdmin(req);const body=Body.parse(await req.json());const db=getServerSupabase();const before=await getBudgetSnapshot();
    const {error}=await db.from('ai_budget_config').update({monthly_budget_amount:body.monthlyBudgetAmount,billing_period_anchor:body.billingPeriodAnchor,enabled:body.enabled,usd_to_thb:body.usdToThb,updated_at:new Date().toISOString()}).eq('id',1);if(error)throw error;
    const after=await getBudgetSnapshot();await writeAdminAudit({action:'ai_budget_updated',subjectType:'ai_budget',previousValue:before,newValue:after});return NextResponse.json({ok:true,budget:after});
  }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'ADMIN_AI_BUDGET_FAILED'},{status:400});}
}
