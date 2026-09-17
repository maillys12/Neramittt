export type ChatSegment = { type: 'text' | 'code'; content: string };

export function splitChatMarkdown(input: string): ChatSegment[] {
  const parts = input.split('```');
  const segments: ChatSegment[] = [];

  parts.forEach((part, index) => {
    const trimmed = part.trim();
    if (!trimmed) return;

    if (index % 2 === 0) {
      segments.push({ type: 'text', content: trimmed });
      return;
    }

    const withoutLanguage = trimmed.replace(/^[a-zA-Z0-9_-]+\n/, '').trim();
    segments.push({ type: 'code', content: withoutLanguage });
  });

  return segments;
}
