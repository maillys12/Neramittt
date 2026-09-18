import { describe, expect, it } from 'vitest';
import { AssistantTurnSchema, ChatStreamEventSchema } from '@/lib/chat/contracts';
import { workStageLabel } from '@/lib/chat/status';

describe('structured chat contracts', () => {
  it('accepts supported work stages and rejects unknown stages', () => {
    expect(ChatStreamEventSchema.parse({ type: 'stage', stage: 'researching' })).toEqual({
      type: 'stage',
      stage: 'researching',
    });
    expect(() => ChatStreamEventSchema.parse({ type: 'stage', stage: 'pretending' })).toThrow();
  });

  it('requires two to five distinct smart reply choices', () => {
    const turn = AssistantTurnSchema.parse({
      type: 'question',
      message: 'ต้องการบรรยากาศแบบใดครับ?',
      interaction: {
        type: 'single_choice',
        options: [
          { id: 'formal', label: 'เป็นทางการ', value: 'formal', kind: 'choice' },
          { id: 'friendly', label: 'เป็นมิตร', value: 'friendly', kind: 'choice' },
          { id: 'other', label: 'อื่น ๆ', value: '', kind: 'custom' },
        ],
        allowCustom: true,
      },
      briefPatch: {},
    });

    expect(turn.type).toBe('question');
    if (turn.type !== 'question') throw new Error('Expected question turn');
    expect(turn.interaction?.options).toHaveLength(3);
    expect(() => AssistantTurnSchema.parse({
      type: 'question',
      message: 'เลือกหนึ่งข้อ',
      interaction: {
        type: 'single_choice',
        options: [{ id: 'only', label: 'ข้อเดียว', value: 'only', kind: 'choice' }],
        allowCustom: false,
      },
      briefPatch: {},
    })).toThrow();
  });

  it('rejects unsafe or incomplete source references in final turns', () => {
    const base = {
      type: 'final' as const,
      message: 'พร้อมใช้งานแล้วครับ',
      prompts: [{ id: 'p1', label: 'แนวทางหลัก', content: 'หัวข้อและสื่อ: โปสเตอร์' }],
      copySuggestions: { missingFacts: [] },
      recommendations: { include: [], exclude: [] },
      warnings: [],
      briefPatch: {},
    };

    expect(() => AssistantTurnSchema.parse({
      ...base,
      sources: [{ title: 'Official source', url: 'not-a-url', domain: 'example.org', sourceType: 'official' }],
    })).toThrow();
  });
});

describe('work stage localization', () => {
  it('returns exact Thai and English labels for identity verification', () => {
    expect(workStageLabel('identity_check', 'th')).toBe('กำลังตรวจสอบอัตลักษณ์และแหล่งข้อมูลทางการ');
    expect(workStageLabel('identity_check', 'en')).toBe('Checking official identity and sources');
  });
});
