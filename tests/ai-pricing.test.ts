import { describe,expect,it } from 'vitest';
import { calculateEstimatedCost } from '@/lib/ai/pricing';

describe('AI pricing',()=>{
  it('uses short-context Luna rates plus web-search cost',()=>{
    const result=calculateEstimatedCost({model:'gpt-5.6-luna',usage:{inputTokens:100_000,outputTokens:100_000,cachedTokens:0,toolCalls:1},usdToThb:34});
    expect(result.usd).toBeCloseTo(0.08,8);
    expect(result.thb).toBeCloseTo(2.72,6);
    expect(result.pricingVersion).toBe('openai-api-pricing-2026-09-19');
  });
  it('switches to long-context rates above 272K input tokens',()=>{
    const result=calculateEstimatedCost({model:'gpt-5.6-luna',usage:{inputTokens:1_000_000,outputTokens:1_000_000,cachedTokens:0},usdToThb:34});
    expect(result.usd).toBeCloseTo(1.10,8);
  });
  it('uses cached-input pricing',()=>{
    const result=calculateEstimatedCost({model:'gpt-5.6-luna',usage:{inputTokens:100_000,outputTokens:0,cachedTokens:100_000},usdToThb:34});
    expect(result.usd).toBeCloseTo(0.001,8);
  });
  it('rejects unknown models',()=>{
    expect(()=>calculateEstimatedCost({model:'unknown',usage:{inputTokens:1,outputTokens:1,cachedTokens:0},usdToThb:34})).toThrow('AI_PRICE_UNKNOWN');
  });
});
