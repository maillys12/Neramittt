import { describe, expect, it } from 'vitest';
import { buildChatInstructions, buildLegacyChatInstructions } from '@/lib/ui/chat-instructions';

describe('buildChatInstructions', () => {
  it('makes the selected language govern the complete Thai experience', () => {
    const text = buildChatInstructions({ platform: 'chatgpt', language: 'th', variantCount: 1 });
    expect(text).toContain('ตอบผู้ใช้และเขียนพรอมต์ฉบับสมบูรณ์เป็นภาษาไทยระดับมืออาชีพ');
    expect(text).toContain('concise natural-language instruction');
    expect(text).not.toContain('Every final prompt must use these language-specific sections');
    expect(text).not.toContain('final image generation prompt must be written entirely in English');
  });

  it('makes the selected language govern the complete English experience', () => {
    const text = buildChatInstructions({ platform: 'gemini', language: 'en', variantCount: 2 });
    expect(text).toContain('Respond to the user and write every final prompt in advanced professional English');
    expect(text).toContain('Subject & Medium');
    expect(text).toContain('exactly 2');
  });

  it('requires research and distinguishes verified facts from creative suggestions', () => {
    const text = buildChatInstructions({ platform: 'chatgpt', language: 'th', variantCount: 1 });
    expect(text).toContain('Every final prompt job must use the supplied live research findings');
    expect(text).toContain('verified fact');
    expect(text).toContain('creative suggestion');
  });

  it('directs the model as a creative director before it writes a prompt', () => {
    const text = buildChatInstructions({ platform: 'chatgpt', language: 'th', variantCount: 1 });
    expect(text).toContain('communication objective');
    expect(text).toContain('information hierarchy');
    expect(text).toContain('one dominant visual idea');
    expect(text).toContain('Do not turn every user detail into a visual object');
    expect(text).toContain('make reasonable art-direction decisions yourself');
  });

  it('requires a finished composition instead of an empty poster template', () => {
    const text = buildChatInstructions({ platform: 'chatgpt', language: 'en', variantCount: 1 });
    expect(text).toContain('finished, publication-ready design');
    expect(text).toContain('natural negative space');
    expect(text).toContain('visible placeholder boxes');
    expect(text).toContain('form fields');
    expect(text).toContain('pseudo-text');
  });

  it('never invents an official logo and reserves space when no authentic asset exists', () => {
    const text = buildChatInstructions({ platform: 'chatgpt', language: 'en', variantCount: 1 });
    expect(text).toContain('Never invent, redraw, imitate, or approximate an official logo');
    expect(text).toContain('reserve an appropriate logo area');
  });

  it('frames the task as new image generation rather than editing an existing image', () => {
    const text = buildChatInstructions({ platform: 'chatgpt', language: 'th', variantCount: 1 });
    expect(text).toContain('create a new image from scratch');
    expect(text).toContain('Do not phrase the prompt as editing, modifying, replacing, retouching, or changing an existing image');
  });

  it('keeps the rollback path copy-safe without requesting structured JSON', () => {
    const text = buildLegacyChatInstructions({ platform: 'chatgpt', language: 'th', variantCount: 1 });
    expect(text).toContain('fenced Markdown code block');
    expect(text).toContain('ภาษาไทยระดับมืออาชีพ');
    expect(text).toContain('concise natural-language instruction');
    expect(text).not.toContain('structured AssistantTurn schema');
  });
});
