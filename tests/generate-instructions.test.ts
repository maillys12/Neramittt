import { describe, expect, it } from 'vitest';
import { buildGenerationInstructions } from '@/lib/generate/instructions';

describe('direct generation instructions', () => {
  it('honors Thai prompt language in the direct generation route', () => {
    const text = buildGenerationInstructions({ platform: 'chatgpt', language: 'th', variantCount: 1 }, 1);
    expect(text).toContain('ภาษาไทยระดับมืออาชีพ');
    expect(text).toContain('1–3 short paragraphs');
    expect(text).not.toContain('หัวข้อและสื่อ: ...');
    expect(text).not.toContain('ค่า prompt ของทุกแบบต้องเป็นภาษาอังกฤษล้วน');
  });

  it('keeps explicit sections for platforms that benefit from detailed prompts', () => {
    const text = buildGenerationInstructions({ platform: 'gemini', language: 'en', variantCount: 1 }, 1);
    expect(text).toContain('Subject & Medium: ...');
  });

  it('uses the same creative-director and capability-aware rules as chat', () => {
    const text = buildGenerationInstructions({ platform: 'chatgpt', language: 'en', variantCount: 2 }, 2);
    expect(text).toContain('communication objective');
    expect(text).toContain('finished, publication-ready design');
    expect(text).toContain('short verified display copy');
  });
});
