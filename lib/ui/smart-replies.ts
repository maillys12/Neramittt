import { hasFencedPromptBlocks } from '@/lib/ui/image-prompt-policy';

export type AssistantEnvelope = {
  message: string;
  replies: string[];
};

const SMART_REPLY_RE = /\n?<smart_replies>([\s\S]*?)<\/smart_replies>\s*$/i;

function normalizeReplies(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const clean = entry.trim().replace(/\s+/g, ' ');
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    result.push(clean);
    if (result.length === 4) break;
  }
  return result;
}

export function parseAssistantEnvelope(raw: string): AssistantEnvelope {
  const clean = raw.trim();
  if (!clean || hasFencedPromptBlocks(clean)) return { message: clean, replies: [] };

  const match = clean.match(SMART_REPLY_RE);
  if (!match) return { message: clean, replies: [] };

  let replies: string[] = [];
  try {
    replies = normalizeReplies(JSON.parse(match[1]));
  } catch {
    replies = [];
  }

  return {
    message: clean.replace(SMART_REPLY_RE, '').trim(),
    replies,
  };
}

export function serializeAssistantEnvelope(input: AssistantEnvelope): string {
  const message = input.message.trim();
  const replies = normalizeReplies(input.replies);
  if (!message || !replies.length || hasFencedPromptBlocks(message)) return message;
  return `${message}\n<smart_replies>${JSON.stringify(replies)}</smart_replies>`;
}
