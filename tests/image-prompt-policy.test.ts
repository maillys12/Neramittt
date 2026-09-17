import { describe, expect, it } from 'vitest';
import {
  FINAL_THAI_REMARK,
  sanitizeModelText,
  validateFinalPromptResponse,
} from '@/lib/ui/image-prompt-policy';

describe('image prompt output policy', () => {
  it('removes malformed and invisible characters without damaging Thai conversation', () => {
    const input = `สวัสดี\u200Bครับ � ยินดีช่วย\uFEFF`; 
    expect(sanitizeModelText(input)).toBe('สวัสดีครับ  ยินดีช่วย');
  });

  it('accepts structured English prompts with blank-space text instructions', () => {
    const output = [
      'พรอมต์พร้อมแล้วครับ',
      '```',
      'Subject & Medium: Modern university event poster background, minimal editorial style',
      'Elements & Details: Abstract geometric forms and subtle academic visual motifs',
      'Colors & Lighting: Warm orange and deep purple accents, soft studio lighting',
      'Composition & Layout: Strong visual hierarchy with generous whitespace',
      'Text Placeholder Instructions: Leave blank space for text and negative space for typography',
      'Parameters: --ar 4:5',
      '```',
      FINAL_THAI_REMARK,
    ].join('\n');
    expect(validateFinalPromptResponse(output, 1)).toEqual({ ok: true, reasons: [] });
  });

  it('rejects Thai inside the image prompt and direct Thai text rendering instructions', () => {
    const output = [
      'พรอมต์พร้อมแล้วครับ',
      '```',
      'Subject & Medium: Poster background',
      'Elements & Details: เขียนคำว่า สมัครสมาชิก ลงบนภาพ',
      'Colors & Lighting: Blue and yellow',
      'Composition & Layout: Centered composition',
      'Text Placeholder Instructions: Render Thai text clearly in the image',
      'Parameters: --ar 4:5',
      '```',
      FINAL_THAI_REMARK,
    ].join('\n');
    const result = validateFinalPromptResponse(output, 1);
    expect(result.ok).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/Thai|render/i);
  });

  it('requires one fenced code block per requested prompt and the exact Thai remark at the end', () => {
    const output = '```\nSubject & Medium: Poster\n```';
    const result = validateFinalPromptResponse(output, 2);
    expect(result.ok).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/2|remark|structure/i);
  });
});
