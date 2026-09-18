import { describe,expect,it } from 'vitest';
import { extractOpenAIUsage } from '@/lib/ai/usage';

describe('OpenAI usage extraction',()=>{
  it('extracts token details and tool calls',()=>{
    const usage=extractOpenAIUsage({usage:{input_tokens:120,output_tokens:30,input_tokens_details:{cached_tokens:20}},output:[{type:'web_search_call'},{type:'message'}]});
    expect(usage).toEqual({inputTokens:120,outputTokens:30,cachedTokens:20,toolCalls:1});
  });
  it('returns safe zeroes for missing usage',()=>{
    expect(extractOpenAIUsage({})).toEqual({inputTokens:0,outputTokens:0,cachedTokens:0,toolCalls:0});
  });
  it('never lets cached tokens exceed input tokens',()=>{
    expect(extractOpenAIUsage({usage:{input_tokens:10,input_tokens_details:{cached_tokens:100}}}).cachedTokens).toBe(10);
  });
});
