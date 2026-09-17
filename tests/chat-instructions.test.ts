import { describe, expect, it } from 'vitest';
import { buildChatInstructions } from '@/lib/ui/chat-instructions';

describe('buildChatInstructions', () => {
  it('always gathers requirements in natural Thai but writes final image prompts in English', () => {
    const text = buildChatInstructions({ platform: 'chatgpt', language: 'th', variantCount: 1 });
    expect(text).toContain('Communicate with the user in correct, natural, polite Thai');
    expect(text).toContain('final image generation prompt must be written entirely in English');
    expect(text).not.toContain('เขียนพรอมต์ฉบับสุดท้ายเป็นภาษาไทย');
  });

  it('never asks an image model to render Thai text and reserves blank space instead', () => {
    const text = buildChatInstructions({ platform: 'chatgpt', language: 'en', variantCount: 2 });
    expect(text).toContain('NEVER instruct the image generation AI to render Thai text');
    expect(text).toContain('leave blank space for text');
    expect(text).toContain('negative space for typography');
    expect(text).toContain('exactly 2');
  });

  it('requires structured English prompts in fenced code blocks and the exact Thai remark', () => {
    const text = buildChatInstructions({ platform: 'gemini', language: 'en', variantCount: 3 });
    expect(text).toContain('Subject & Medium');
    expect(text).toContain('Elements & Details');
    expect(text).toContain('Colors & Lighting');
    expect(text).toContain('Composition & Layout');
    expect(text).toContain('Parameters');
    expect(text).toContain('triple backticks');
    expect(text).toContain('กรุณานำพรอมต์นี้ไปใช้สร้างภาพ และนำภาพที่ได้ไปพิมพ์ข้อความภาษาไทยทับเองในแอปพลิเคชันอื่น');
  });
});
