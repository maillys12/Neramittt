import { describe, expect, it } from 'vitest';
import {
  POST_OUTPUT_GUIDANCE_THAI,
  sanitizeModelText,
  validateFinalPromptResponse,
} from '@/lib/ui/image-prompt-policy';

describe('image prompt output policy', () => {
  it('removes malformed and invisible characters without damaging Thai conversation', () => {
    const input = `สวัสดี\u200Bครับ � ยินดีช่วย\uFEFF`;
    expect(sanitizeModelText(input)).toBe('สวัสดีครับ  ยินดีช่วย');
  });

  it('accepts only structured English prompt blocks with no trailing Thai model text', () => {
    const output = [
      '```',
      'Subject & Medium: Modern university event poster background, minimal editorial style',
      'Elements & Details: Abstract geometric forms and subtle academic visual motifs',
      'Colors & Lighting: Warm orange and deep purple accents, soft studio lighting',
      'Composition & Layout: Strong visual hierarchy with generous whitespace',
      'Text Placeholder Instructions: Leave blank space for text and negative space for typography',
      'Parameters: --ar 4:5',
      '```',
    ].join('\n');
    expect(validateFinalPromptResponse(output, 1)).toEqual({ ok: true, reasons: [] });
    expect(POST_OUTPUT_GUIDANCE_THAI).toContain('พรอมต์ภาษาอังกฤษด้านบนนี้');
  });

  it('rejects Thai inside the image prompt and direct Thai text rendering instructions', () => {
    const output = [
      '```',
      'Subject & Medium: Poster background',
      'Elements & Details: เขียนคำว่า สมัครสมาชิก ลงบนภาพ',
      'Colors & Lighting: Blue and yellow',
      'Composition & Layout: Centered composition',
      'Text Placeholder Instructions: Render Thai text clearly in the image',
      'Parameters: --ar 4:5',
      '```',
    ].join('\n');
    const result = validateFinalPromptResponse(output, 1);
    expect(result.ok).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/Thai|render/i);
  });

  it('rejects any prose immediately outside the fenced prompt blocks', () => {
    const output = [
      '```',
      'Subject & Medium: Poster background',
      'Elements & Details: Abstract geometric forms',
      'Colors & Lighting: Blue and yellow',
      'Composition & Layout: Centered composition',
      'Parameters: --ar 4:5',
      '```',
      'นำไปใช้สร้างภาพได้เลยครับ',
    ].join('\n');
    const result = validateFinalPromptResponse(output, 1);
    expect(result.ok).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/outside|prose|code block/i);
  });

  it('rejects edit-existing-image instructions when no reference image workflow is intended', () => {
    const output = [
      '```',
      'Subject & Medium: Poster background',
      'Elements & Details: Edit the existing image and replace the person with a student',
      'Colors & Lighting: Soft daylight',
      'Composition & Layout: Balanced vertical layout',
      'Parameters: --ar 4:5',
      '```',
    ].join('\n');
    const result = validateFinalPromptResponse(output, 1);
    expect(result.ok).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/existing image|edit/i);
  });
});
