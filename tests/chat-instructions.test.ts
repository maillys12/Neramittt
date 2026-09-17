import { describe, expect, it } from 'vitest';
import { buildChatInstructions } from '@/lib/ui/chat-instructions';

describe('buildChatInstructions', () => {
  it('uses English for conversation and the final prompt when English is selected', () => {
    const text = buildChatInstructions({ platform: 'chatgpt', language: 'en', variantCount: 2 });
    expect(text).toContain('Respond to the user in English');
    expect(text).toContain('Write every final prompt in English');
    expect(text).toContain('exactly 2');
  });

  it('keeps Thai mode in Thai', () => {
    const text = buildChatInstructions({ platform: 'chatgpt', language: 'th', variantCount: 1 });
    expect(text).toContain('ตอบผู้ใช้เป็นภาษาไทย');
    expect(text).toContain('เขียนพรอมต์ฉบับสุดท้ายเป็นภาษาไทย');
  });

  it('requires final prompts to be returned directly in fenced code blocks', () => {
    const text = buildChatInstructions({ platform: 'gemini', language: 'en', variantCount: 3 });
    expect(text).toContain('triple backticks');
    expect(text).toContain('Do not tell the user to go to another step');
    expect(text).toContain('exactly 3');
  });
});
