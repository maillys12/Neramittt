import { describe, expect, it } from 'vitest';
import { sendChatOptimistically } from '@/lib/ui/chat-send';

describe('sendChatOptimistically', () => {
  it('shows the user message and clears the composer before waiting for draft creation', async () => {
    const events: string[] = [];
    let releaseDraft!: (value: string) => void;
    const draftPromise = new Promise<string>(resolve => { releaseDraft = resolve; });

    const pending = sendChatOptimistically({
      message: '  สวัสดี  ',
      appendUser: message => events.push(`append:${message}`),
      clearInput: () => events.push('clear'),
      ensureDraft: async () => {
        events.push('ensure-draft');
        return draftPromise;
      },
      requestAssistant: async (_draftId, message) => {
        events.push(`request:${message}`);
        return { message: 'สวัสดีครับ' };
      },
    });

    expect(events).toEqual(['append:สวัสดี', 'clear', 'ensure-draft']);

    releaseDraft('draft-1');
    await pending;
    expect(events).toEqual(['append:สวัสดี', 'clear', 'ensure-draft', 'request:สวัสดี']);
  });

  it('does nothing for blank messages', async () => {
    const events: string[] = [];
    const result = await sendChatOptimistically({
      message: '   ',
      appendUser: () => events.push('append'),
      clearInput: () => events.push('clear'),
      ensureDraft: async () => 'draft-1',
      requestAssistant: async () => ({ message: 'unused' }),
    });
    expect(result).toBeNull();
    expect(events).toEqual([]);
  });
});
