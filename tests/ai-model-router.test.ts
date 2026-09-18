import { describe,expect,it } from 'vitest';
import { resolveModelForStage } from '@/lib/ai/model-router';
import { SAFE_RUNTIME_CONFIG,SAFE_STAGE_CONFIG } from '@/lib/ai/safe-defaults';

function runtime(){
  return {safeMode:false,autoRoutingEnabled:true,stages:Object.fromEntries(Object.entries(SAFE_STAGE_CONFIG).map(([k,v])=>[k,{...v}]))} as typeof SAFE_RUNTIME_CONFIG;
}

describe('AI model routing',()=>{
  it('uses Auto Routing by stage',()=>{
    const result=resolveModelForStage({stage:'creative_director',runtime:runtime()});
    expect(result.model).toBe('gpt-5.6-terra');
    expect(result.source).toBe('auto');
  });
  it('uses manual override before auto',()=>{
    const r=runtime();r.stages.research={...r.stages.research,mode:'manual',modelOverride:'gpt-5.6-sol'};
    const result=resolveModelForStage({stage:'research',runtime:r});
    expect(result.model).toBe('gpt-5.6-sol');
    expect(result.source).toBe('manual');
  });
  it('lets budget policy override manual',()=>{
    const r=runtime();r.stages.research={...r.stages.research,mode:'manual',modelOverride:'gpt-5.6-sol'};
    const result=resolveModelForStage({stage:'research',runtime:r,budgetPolicy:{forceCostSaver:true}});
    expect(result.model).toBe('gpt-5.6-luna');
    expect(result.source).toBe('budget_guard');
  });
  it('lets Budget Guard lower reasoning without changing the chosen model',()=>{
    const r=runtime();r.stages.research={...r.stages.research,mode:'manual',modelOverride:'gpt-5.6-sol',reasoningEffort:'high'};
    const result=resolveModelForStage({stage:'research',runtime:r,budgetPolicy:{forcedReasoning:'low'}});
    expect(result.model).toBe('gpt-5.6-sol');
    expect(result.reasoningEffort).toBe('low');
    expect(result.source).toBe('budget_guard');
  });
  it('lets safe mode override everything',()=>{
    const r=runtime();r.safeMode=true;r.stages.research={...r.stages.research,mode:'manual',modelOverride:'gpt-5.6-sol'};
    const result=resolveModelForStage({stage:'research',runtime:r,budgetPolicy:{forcedModel:'gpt-5.6-terra'}});
    expect(result.source).toBe('safe_mode');
    expect(result.model).toBe('gpt-5.6-luna');
  });
  it('blocks paused AI before provider calls',()=>{
    expect(()=>resolveModelForStage({stage:'research',runtime:runtime(),budgetPolicy:{paused:true}})).toThrow('AI_PAUSED');
  });
});
