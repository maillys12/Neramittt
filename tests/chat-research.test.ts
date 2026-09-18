import { describe, expect, it } from 'vitest';
import { runResearchChat } from '@/lib/chat/orchestrator';
import type { AssistantTurn, WorkStage } from '@/lib/chat/contracts';

const validThaiFinal: AssistantTurn = {
  type: 'final',
  message: 'จัดทำแนวทางพร้อมใช้งานแล้วครับ',
  prompts: [{
    id: 'main',
    label: 'แนวทางหลัก',
    content: [
      'หัวข้อและสื่อ: โปสเตอร์ทางการสำหรับสถาบันการศึกษา',
      'องค์ประกอบและรายละเอียด: ภาพลักษณ์น่าเชื่อถือและไม่สร้างตราสัญลักษณ์ขึ้นใหม่',
      'สีและแสง: สีประจำสถาบันที่ตรวจสอบแล้วและแสงสะอาด',
      'องค์ประกอบและการจัดวาง: ลำดับข้อมูลชัดเจนและเว้นพื้นที่สำหรับตราทางการ',
      'คำแนะนำพื้นที่ข้อความ: เว้นพื้นที่สะอาดสำหรับข้อความและโลโก้จริงที่จะนำมาวางภายหลัง',
      'พารามิเตอร์: --ar 1:1',
    ].join('\n'),
  }],
  copySuggestions: { headline: 'ร่วมเป็นส่วนหนึ่งกับเรา', missingFacts: [] },
  recommendations: { include: [], exclude: [] },
  sources: [{ title: 'Official faculty', url: 'https://medicine.kku.ac.th/', domain: 'medicine.kku.ac.th', sourceType: 'official' }],
  warnings: ['โปรดแนบไฟล์โลโก้ทางการเพื่อวางโดยไม่แก้ไข'],
  briefPatch: {},
};

describe('research chat orchestration', () => {
  it('researches every request and emits identity verification only for official work', async () => {
    const stages: WorkStage[] = [];
    const calls: string[] = [];
    const turn = await runResearchChat({
      message: 'สร้างโปสเตอร์สำนักแพทยศาสตร์ มหาวิทยาลัยขอนแก่น',
      history: [],
      settings: { platform: 'chatgpt', language: 'th', variantCount: 1 },
      assets: [],
    }, stage => { stages.push(stage); }, {
      generate: async input => {
        calls.push(input.message);
        return validThaiFinal;
      },
    });

    expect(calls).toEqual(['สร้างโปสเตอร์สำนักแพทยศาสตร์ มหาวิทยาลัยขอนแก่น']);
    expect(stages).toContain('researching');
    expect(stages).toContain('identity_check');
    expect(stages.at(0)).toBe('analyzing');
    expect(stages.at(-1)).toBe('finalizing');
    expect(turn.type).toBe('final');
  });

  it('still performs research for a generic fact-free creative request', async () => {
    const stages: WorkStage[] = [];
    const genericTurn: AssistantTurn = {
      type: 'question',
      message: 'ต้องการบรรยากาศแบบใดครับ?',
      interaction: {
        type: 'single_choice',
        options: [
          { id: 'warm', label: 'อบอุ่น', value: 'warm', kind: 'choice' },
          { id: 'playful', label: 'สนุกสนาน', value: 'playful', kind: 'choice' },
        ],
        allowCustom: false,
      },
      briefPatch: {},
    };
    await runResearchChat({
      message: 'ทำโปสเตอร์วันเกิดน่ารัก ๆ',
      history: [],
      settings: { platform: 'chatgpt', language: 'th', variantCount: 1 },
      assets: [],
    }, stage => { stages.push(stage); }, { generate: async () => genericTurn });

    expect(stages).toContain('researching');
    expect(stages).not.toContain('identity_check');
  });

  it('repairs one unsafe official result and returns the repaired turn', async () => {
    let attempts = 0;
    const unsafe = {
      ...validThaiFinal,
      prompts: [{ ...validThaiFinal.prompts[0], content: validThaiFinal.prompts[0].content.replace('เว้นพื้นที่สำหรับตราทางการ', 'สร้างตราสัญลักษณ์ให้คล้ายของจริง') }],
      warnings: [],
    } satisfies AssistantTurn;

    const turn = await runResearchChat({
      message: 'โปสเตอร์ทางการของมหาวิทยาลัย',
      history: [],
      settings: { platform: 'chatgpt', language: 'th', variantCount: 1 },
      assets: [],
    }, () => undefined, {
      generate: async input => {
        attempts += 1;
        return input.repairReasons?.length ? validThaiFinal : unsafe;
      },
    });

    expect(attempts).toBe(2);
    expect(turn).toEqual(validThaiFinal);
  });
});
