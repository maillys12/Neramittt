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
});
