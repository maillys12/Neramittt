import { describe, expect, it } from 'vitest';
import { buildChatInstructions } from '@/lib/ui/chat-instructions';
import { defaultCreationSettings } from '@/lib/ui/creation-settings';

describe('finished design prompt guidance', () => {
  it('uses integrated negative space instead of visible placeholder UI', () => {
    const instructions = buildChatInstructions(defaultCreationSettings);

    expect(instructions).toContain('finished, publication-ready design');
    expect(instructions).toContain('natural negative space');
    expect(instructions).toContain('visible placeholder boxes');
    expect(instructions).toContain('form fields');
    expect(instructions).toContain('pseudo-text');
  });

  it('acts as a creative director before writing the prompt', () => {
    const instructions = buildChatInstructions(defaultCreationSettings);

    expect(instructions).toContain('communication objective');
    expect(instructions).toContain('visual hierarchy');
    expect(instructions).toContain('Do not turn every user detail into a visual object');
    expect(instructions).toContain('make reasonable art-direction decisions yourself');
  });

  it('allows final prompts to be returned in Thai when the selected UI language is Thai', () => {
    const instructions = buildChatInstructions(defaultCreationSettings);

    expect(instructions).toContain('final prompt language');
    expect(instructions).toContain('Thai');
    expect(instructions).not.toContain('must be written entirely in English');
    expect(instructions).not.toContain('never include Thai characters');
  });
});
