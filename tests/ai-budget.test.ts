import { describe,expect,it } from 'vitest';
import { billingWindow } from '@/lib/ai/budget';

describe('billingWindow',()=>{
  it('uses current month when after anchor',()=>{
    const x=billingWindow(5,new Date('2026-09-19T00:00:00Z'));
    expect(x.start.toISOString()).toBe('2026-09-05T00:00:00.000Z');
    expect(x.end.toISOString()).toBe('2026-10-05T00:00:00.000Z');
  });
  it('uses previous month when before anchor',()=>{
    const x=billingWindow(20,new Date('2026-09-19T00:00:00Z'));
    expect(x.start.toISOString()).toBe('2026-08-20T00:00:00.000Z');
    expect(x.end.toISOString()).toBe('2026-09-20T00:00:00.000Z');
  });
  it('clamps anchors to 28 for February safety',()=>{
    const x=billingWindow(31,new Date('2026-02-27T00:00:00Z'));
    expect(x.start.getUTCDate()).toBe(28);
    expect(x.end.getUTCDate()).toBe(28);
  });
});
