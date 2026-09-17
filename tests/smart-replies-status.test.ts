import { describe, expect, it } from 'vitest';
import { parseAssistantEnvelope, serializeAssistantEnvelope } from '@/lib/ui/smart-replies';
import { getThinkingStatus } from '@/lib/ui/thinking-status';

describe('assistant smart replies', () => {
  it('extracts reply cards while keeping the assistant message clean', () => {
    const raw = serializeAssistantEnvelope({
      message: 'ต้องการโทนแบบไหนครับ?',
      replies: ['ทางการ', 'เป็นกันเอง', 'มินิมอล'],
    });

    expect(parseAssistantEnvelope(raw)).toEqual({
      message: 'ต้องการโทนแบบไหนครับ?',
      replies: ['ทางการ', 'เป็นกันเอง', 'มินิมอล'],
    });
  });

  it('deduplicates, trims and caps reply cards at four choices', () => {
    const raw = 'คำถาม\n<smart_replies>["  A  ","A","B","C","D","E",""]</smart_replies>';
    expect(parseAssistantEnvelope(raw)).toEqual({
      message: 'คำถาม',
      replies: ['A', 'B', 'C', 'D'],
    });
  });

  it('returns no reply cards for final fenced prompts', () => {
    const raw = '```\nSubject & Medium: Poster\nElements & Details: Clean\nColors & Lighting: Bright\nComposition & Layout: Square\nParameters: --ar 1:1\n```';
    expect(parseAssistantEnvelope(raw)).toEqual({ message: raw, replies: [] });
  });
});

describe('thinking status progression', () => {
  it('uses neutral truthful stages instead of a single static label', () => {
    expect(getThinkingStatus(0)).toBe('กำลังวิเคราะห์คำขอ');
    expect(getThinkingStatus(2500)).toBe('กำลังจัดระเบียบรายละเอียด');
    expect(getThinkingStatus(6500)).toBe('กำลังเตรียมคำตอบ');
    expect(getThinkingStatus(12000)).toBe('กำลังตรวจความครบถ้วน');
  });
});
