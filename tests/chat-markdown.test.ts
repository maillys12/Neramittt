import { describe, expect, it } from 'vitest';
import { splitChatMarkdown } from '@/lib/ui/chat-markdown';

describe('splitChatMarkdown', () => {
  it('extracts fenced code blocks from assistant text', () => {
    expect(splitChatMarkdown('พร้อมแล้ว\n```\nCreate a clean poster\n```')).toEqual([
      { type: 'text', content: 'พร้อมแล้ว' },
      { type: 'code', content: 'Create a clean poster' },
    ]);
  });

  it('keeps plain assistant replies as text', () => {
    expect(splitChatMarkdown('ขอรายละเอียดโทนสีเพิ่มอีกนิด')).toEqual([
      { type: 'text', content: 'ขอรายละเอียดโทนสีเพิ่มอีกนิด' },
    ]);
  });
});
