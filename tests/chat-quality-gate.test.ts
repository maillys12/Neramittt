import { describe, expect, it } from 'vitest';
import { validateAssistantTurnQuality } from '@/lib/chat/quality-gate';
import type { AssistantTurn } from '@/lib/chat/contracts';

function englishFinal(content: string): AssistantTurn {
  return {
    type: 'final',
    message: 'Your researched prompt is ready.',
    prompts: [{ id: 'main', label: 'Primary direction', content }],
    copySuggestions: { missingFacts: [] },
    recommendations: { include: [], exclude: [] },
    sources: [],
    warnings: [],
    briefPatch: {},
  };
}

const validEnglishPrompt = [
  'Subject & Medium: A polished square recruitment poster created from scratch',
  'Elements & Details: Professional academic imagery with restrained accounting motifs',
  'Colors & Lighting: Deep navy, white, and restrained gold with clean studio lighting',
  'Composition & Layout: Clear hierarchy with balanced margins and an open official identity area',
  'Text Placeholder Instructions: Reserve clean space for verified copy and the authentic supplied logo',
  'Parameters: --ar 1:1',
].join('\n');

describe('assistant turn quality gate', () => {
  it('rejects the wrong number of prompt variants', () => {
    const result = validateAssistantTurnQuality(englishFinal(validEnglishPrompt), {
      settings: { platform: 'chatgpt', language: 'en', variantCount: 2 },
      officialContext: false,
      authenticLogoProvided: false,
    });
    expect(result.ok).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/2 prompt variants/i);
  });

  it('requires a warning and reserved logo space for official work without an authentic asset', () => {
    const result = validateAssistantTurnQuality(englishFinal(validEnglishPrompt.replace('Reserve clean space', 'Use open space')), {
      settings: { platform: 'chatgpt', language: 'en', variantCount: 1 },
      officialContext: true,
      authenticLogoProvided: false,
    });
    expect(result.ok).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/official logo|authentic asset/i);
  });

  it('accepts official work when logo space and an asset warning are present', () => {
    const turn = englishFinal(validEnglishPrompt);
    if (turn.type === 'final') turn.warnings = ['Supply the authentic official logo file; do not recreate it.'];
    const result = validateAssistantTurnQuality(turn, {
      settings: { platform: 'chatgpt', language: 'en', variantCount: 1 },
      officialContext: true,
      authenticLogoProvided: false,
    });
    expect(result).toEqual({ ok: true, reasons: [] });
  });
});
