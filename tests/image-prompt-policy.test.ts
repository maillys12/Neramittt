import { describe, expect, it } from 'vitest';
import {
  buildPromptRepairInstructions,
  POST_OUTPUT_GUIDANCE_THAI,
  promptSections,
  sanitizeModelText,
  validatePromptContent,
  validateFinalPromptResponse,
} from '@/lib/ui/image-prompt-policy';

const englishPrompt = [
  '```',
  'Subject & Medium: Modern university event poster background, minimal editorial style',
  'Elements & Details: Abstract geometric forms and subtle academic visual motifs',
  'Colors & Lighting: Warm orange and deep purple accents, soft studio lighting',
  'Composition & Layout: Strong visual hierarchy with generous whitespace',
  'Text Placeholder Instructions: Leave blank space for text and negative space for typography',
  'Parameters: --ar 4:5',
  '```',
].join('\n');

const thaiPrompt = [
  '```',
  'หัวข้อและสื่อ: โปสเตอร์ประชาสัมพันธ์มหาวิทยาลัยสไตล์บรรณาธิการร่วมสมัย',
  'องค์ประกอบและรายละเอียด: รูปทรงเรขาคณิตและสัญลักษณ์การเรียนรู้ที่เรียบสะอาด',
  'สีและแสง: สีส้มและสีม่วงที่สมดุล พร้อมแสงนุ่มนวล',
  'องค์ประกอบและการจัดวาง: ลำดับสายตาชัดเจนและมีพื้นที่ว่างอย่างเพียงพอ',
  'คำแนะนำพื้นที่ข้อความ: เว้นพื้นที่สะอาดสำหรับวางข้อความภายหลัง',
  'พารามิเตอร์: --ar 4:5',
  '```',
].join('\n');

describe('image prompt output policy', () => {
  it('removes malformed and invisible characters without damaging Thai conversation', () => {
    const input = `สวัสดี\u200Bครับ � ยินดีช่วย\uFEFF`;
    expect(sanitizeModelText(input)).toBe('สวัสดีครับ  ยินดีช่วย');
  });

  it('accepts advanced prompts in the selected language', () => {
    expect(validateFinalPromptResponse(thaiPrompt, 1, 'th')).toEqual({ ok: true, reasons: [] });
    expect(validateFinalPromptResponse(englishPrompt, 1, 'en')).toEqual({ ok: true, reasons: [] });
    expect(validateFinalPromptResponse(thaiPrompt, 1, 'en').ok).toBe(false);
    expect(promptSections('th')).toContain('หัวข้อและสื่อ');
    expect(promptSections('en')).toContain('Subject & Medium');
    expect(POST_OUTPUT_GUIDANCE_THAI).toContain('พรอมต์');
  });

  it('rejects direct Thai text rendering instructions even in Thai prompt mode', () => {
    const output = thaiPrompt.replace(
      'เว้นพื้นที่สะอาดสำหรับวางข้อความภายหลัง',
      'เขียนข้อความภาษาไทยลงบนภาพให้ชัดเจน',
    );
    const result = validateFinalPromptResponse(output, 1, 'th', 'generic');
    expect(result.ok).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/Thai text|ข้อความภาษาไทย/i);
  });

  it('allows short verified Thai display copy for ChatGPT image generation', () => {
    const output = thaiPrompt.replace(
      'เว้นพื้นที่สะอาดสำหรับวางข้อความภายหลัง',
      'เขียนข้อความภาษาไทยลงบนภาพเฉพาะหัวเรื่องสั้นที่ตรวจสอบแล้วว่า “เปิดรับสมัครนักศึกษา” และตรวจคำสะกดทุกตัวอักษร',
    );
    expect(validateFinalPromptResponse(output, 1, 'th', 'chatgpt').ok).toBe(true);
  });

  it('accepts a concise natural ChatGPT prompt without technical section labels', () => {
    const concise = 'สร้างโปสเตอร์ประชาสัมพันธ์สี่เหลี่ยมจัตุรัสที่ดูสมบูรณ์พร้อมใช้งาน ใช้หัวเรื่อง “แจกผ้าคาด” เป็นจุดเด่น จัดวันที่ เวลา และสถานที่ให้อ่านง่าย ใช้โทนสีส้ม–ม่วงและบรรยากาศเป็นมิตร ใส่เฉพาะข้อความที่ให้มาและตรวจคำสะกดภาษาไทยทุกตัวอักษร';
    expect(validatePromptContent(concise, 'th', 'chatgpt')).toEqual({ ok: true, reasons: [] });
  });

  it('rejects prose outside fenced prompt blocks', () => {
    const result = validateFinalPromptResponse(`${englishPrompt}\nReady to use.`, 1, 'en');
    expect(result.ok).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/outside|prose|code block/i);
  });

  it('rejects edit-existing-image instructions when no edit workflow is intended', () => {
    const output = englishPrompt.replace(
      'Abstract geometric forms and subtle academic visual motifs',
      'Edit the existing image and replace the person with a student',
    );
    const result = validateFinalPromptResponse(output, 1, 'en');
    expect(result.ok).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/existing image|edit/i);
  });

  it('rejects template-like prompt instructions that create visible empty containers', () => {
    const content = extractPrompt(englishPrompt).replace(
      'Strong visual hierarchy with generous whitespace',
      'Create separate blank boxes and empty form fields for every future text item',
    );
    const result = validatePromptContent(content, 'en');
    expect(result.ok).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/placeholder|template|empty container|form/i);
  });

  it('accepts a finished composition with integrated natural negative space', () => {
    const content = extractPrompt(englishPrompt).replace(
      'Strong visual hierarchy with generous whitespace',
      'Create a finished publication-ready composition with one dominant focal point and natural negative space integrated into the artwork',
    );
    expect(validatePromptContent(content, 'en')).toEqual({ ok: true, reasons: [] });
  });

  it('repairs art direction instead of only repairing output formatting', () => {
    const text = buildPromptRepairInstructions(1, 'th');
    expect(text).toContain('communication objective');
    expect(text).toContain('finished composition');
    expect(text).toContain('visible placeholder');
  });
});

function extractPrompt(output: string) {
  return output.replace(/^```\n/, '').replace(/\n```$/, '');
}
