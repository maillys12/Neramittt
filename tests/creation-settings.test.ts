import { describe, expect, it } from 'vitest';
import { languageInstruction, normalizeCreationSettings, platformInstruction, settingsPatch } from '@/lib/ui/creation-settings';

describe('creation settings', () => {
  it('normalizes missing and invalid settings to safe defaults', () => {
    expect(normalizeCreationSettings({})).toEqual({ platform: 'chatgpt', language: 'th', variantCount: 1 });
    expect(normalizeCreationSettings({ target_platform: 'nope', prompt_language: 'xx', variant_count: 99 })).toEqual({ platform: 'chatgpt', language: 'th', variantCount: 1 });
  });

  it('reads valid persisted settings from a draft brief', () => {
    expect(normalizeCreationSettings({ target_platform: 'gemini', prompt_language: 'en', variant_count: 3 })).toEqual({ platform: 'gemini', language: 'en', variantCount: 3 });
  });

  it('serializes settings back to draft brief keys', () => {
    expect(settingsPatch({ platform: 'canva', language: 'th', variantCount: 2 })).toEqual({ target_platform: 'canva', prompt_language: 'th', variant_count: 2 });
  });

  it('maps platform and language to generation instructions', () => {
    expect(platformInstruction('chatgpt')).toContain('ChatGPT');
    expect(platformInstruction('gemini')).toContain('Gemini');
    expect(platformInstruction('canva')).toContain('Canva');
    expect(platformInstruction('generic')).toContain('กลาง');
    expect(languageInstruction('th')).toContain('ภาษาไทย');
    expect(languageInstruction('en')).toContain('English');
  });
});
