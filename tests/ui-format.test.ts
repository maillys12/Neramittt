import { describe, expect, it } from 'vitest';
import { briefRows, chatSummaryRows, variantTabLabel } from '@/lib/ui/format';

describe('Neramit UI format helpers', () => {
  it('turns a brief into readable Thai rows without raw JSON', () => {
    expect(briefRows({ topic: 'ชมรมถ่ายภาพ', work_type: 'โปสเตอร์', style: 'สดใส', ratio: '4:5' })).toEqual([
      ['หัวข้อ', 'ชมรมถ่ายภาพ'],
      ['ประเภทงาน', 'โปสเตอร์'],
      ['สไตล์', 'สดใส'],
      ['สัดส่วน', '4:5'],
    ]);
  });

  it('omits empty chat summary fields', () => {
    expect(chatSummaryRows({ topic: 'งานเปิดบ้าน', color: '', ratio: undefined })).toEqual([
      ['หัวข้อ', 'งานเปิดบ้าน'],
    ]);
  });

  it('localizes chat summary labels to the selected language', () => {
    expect(chatSummaryRows({ topic: 'Open house', work_type: 'Poster', color: 'Blue' }, 'en')).toEqual([
      ['Topic', 'Open house'],
      ['Work type', 'Poster'],
      ['Color palette', 'Blue'],
    ]);
  });

  it('creates stable variant tab labels', () => {
    expect(variantTabLabel(0, 'สดใส')).toBe('แบบที่ 1 · สดใส');
    expect(variantTabLabel(1)).toBe('แบบที่ 2');
  });
});
