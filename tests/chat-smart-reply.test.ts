import { describe, expect, it } from 'vitest';
import { buildSmartReplyMessage, isReplyGroupActive } from '@/lib/chat/smart-replies';

describe('smart reply behavior', () => {
  it('keeps the visible label and stable value separate', () => {
    expect(buildSmartReplyMessage({ id: 'formal', label: 'เป็นทางการ', value: 'formal', kind: 'choice' })).toEqual({
      optionId: 'formal',
      label: 'เป็นทางการ',
      value: 'formal',
    });
  });

  it('deactivates a reply group after a later message or a selection', () => {
    expect(isReplyGroupActive(3, 3, false, false)).toBe(true);
    expect(isReplyGroupActive(3, 4, false, false)).toBe(false);
    expect(isReplyGroupActive(3, 3, true, false)).toBe(false);
    expect(isReplyGroupActive(3, 3, false, true)).toBe(false);
  });

  it('uses custom text as both the visible answer and stable value', () => {
    expect(buildSmartReplyMessage({ id: 'other', label: 'อื่น ๆ', value: '', kind: 'custom' }, 'อบอุ่นแต่เป็นทางการ')).toEqual({
      optionId: 'other',
      label: 'อบอุ่นแต่เป็นทางการ',
      value: 'อบอุ่นแต่เป็นทางการ',
    });
  });
});
