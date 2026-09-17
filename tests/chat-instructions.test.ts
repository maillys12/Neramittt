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

  it('returns only fenced English prompts with no Thai prose appended by the model', () => {
    const text = buildChatInstructions({ platform: 'gemini', language: 'en', variantCount: 3 });
    expect(text).toContain('Subject & Medium');
    expect(text).toContain('Elements & Details');
    expect(text).toContain('Colors & Lighting');
    expect(text).toContain('Composition & Layout');
    expect(text).toContain('Parameters');
    expect(text).toContain('triple backticks');
    expect(text).toContain('output only the fenced prompt code block');
    expect(text).not.toContain('กรุณานำพรอมต์นี้ไปใช้สร้างภาพ');
  });

  it('frames the task as new image generation rather than editing an existing image', () => {
    const text = buildChatInstructions({ platform: 'chatgpt', language: 'th', variantCount: 1 });
    expect(text).toContain('create a new image from scratch');
    expect(text).toContain('Do not phrase the prompt as editing, modifying, replacing, retouching, or changing an existing image');
  });
});
