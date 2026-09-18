import { describe, expect, it } from 'vitest';
import { assistantTurnContent, assistantTurnMetadata, serializeChatError } from '@/lib/chat/persistence';
import type { AssistantTurn } from '@/lib/chat/contracts';

const question: AssistantTurn = {
  type: 'question',
  message: 'ต้องการโทนแบบใดครับ?',
  interaction: {
    type: 'single_choice',
    options: [
      { id: 'formal', label: 'เป็นทางการ', value: 'formal', kind: 'choice' },
      { id: 'friendly', label: 'เป็นมิตร', value: 'friendly', kind: 'choice' },
    ],
    allowCustom: false,
  },
  briefPatch: { mood: 'pending' },
};

describe('chat persistence helpers', () => {
  it('stores a readable text representation alongside the structured turn', () => {
    expect(assistantTurnContent(question)).toBe('ต้องการโทนแบบใดครับ?');
    expect(assistantTurnMetadata(question, 'c9da29d5-06f8-4a58-8fe3-762dd33ff839')).toEqual({
      version: 2,
      requestId: 'c9da29d5-06f8-4a58-8fe3-762dd33ff839',
      turn: question,
    });
  });

  it('keeps final prompts in the readable conversation content', () => {
    const final: AssistantTurn = {
      type: 'final',
      message: 'พร้อมใช้งานแล้ว',
      prompts: [{ id: 'p1', label: 'หลัก', content: 'หัวข้อและสื่อ: โปสเตอร์' }],
      copySuggestions: { missingFacts: [] },
      recommendations: { include: [], exclude: [] },
      sources: [],
      warnings: [],
      briefPatch: {},
    };
    expect(assistantTurnContent(final)).toContain('หัวข้อและสื่อ: โปสเตอร์');
  });

  it('maps internal failures to localized safe stream errors', () => {
    expect(serializeChatError(new Error('RESEARCH_FAILED'), 'th')).toEqual({
      type: 'error',
      code: 'RESEARCH_FAILED',
      message: 'ค้นคว้าข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง',
      retryable: true,
    });
    expect(serializeChatError(new Error('database password leaked'), 'en')).toEqual({
      type: 'error',
      code: 'CHAT_FAILED',
      message: 'Neramit could not complete this request. Please try again.',
      retryable: true,
    });
  });
});
