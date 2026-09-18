import { describe,expect,it } from 'vitest';
import { evaluateBudgetGuard } from '@/lib/ai/budget-guard';

const snapshot={enabled:true,monthlyBudgetThb:1000,usedThb:900,remainingThb:100,usedPercent:90,periodStart:'2026-09-01',periodEnd:'2026-10-01',usdToThb:34,dailyCostThb:20,monthlyCostThb:900};

describe('Budget Guard',()=>{
  it('ignores disabled rules',()=>{
    const result=evaluateBudgetGuard({snapshot,rules:[{id:'1',enabled:false,priority:1,conditionMetric:'budget_used_percent',operator:'gte',threshold:10,action:'pause_ai',actionConfig:{}}],stage:'research'});
    expect(result.mode).toBe('normal');
  });
  it('returns cost saver for matching rule',()=>{
    const result=evaluateBudgetGuard({snapshot,rules:[{id:'1',enabled:true,priority:1,conditionMetric:'budget_used_percent',operator:'gte',threshold:80,action:'cost_saver',actionConfig:{}}],stage:'research'});
    expect(result.mode).toBe('cost_saver');
  });
  it('applies disabled-stage only to matching stage',()=>{
    const rules=[{id:'1',enabled:true,priority:1,conditionMetric:'budget_used_percent' as const,operator:'gte' as const,threshold:80,action:'disable_stage' as const,actionConfig:{stage:'research'}}];
    expect(evaluateBudgetGuard({snapshot,rules,stage:'research'}).mode).toBe('restricted');
    expect(evaluateBudgetGuard({snapshot,rules,stage:'final_prompt'}).mode).toBe('normal');
  });
  it('gives pause the strongest resulting mode',()=>{
    const result=evaluateBudgetGuard({snapshot,rules:[
      {id:'1',enabled:true,priority:1,conditionMetric:'budget_used_percent',operator:'gte',threshold:80,action:'notify_warning',actionConfig:{}},
      {id:'2',enabled:true,priority:2,conditionMetric:'budget_used_percent',operator:'gte',threshold:90,action:'pause_ai',actionConfig:{}},
    ],stage:'research'});
    expect(result.mode).toBe('paused');
  });
});
