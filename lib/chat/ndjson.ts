import { ChatStreamEventSchema, type ChatStreamEvent } from '@/lib/chat/contracts';

export function encodeChatEvent(event: ChatStreamEvent) {
  return `${JSON.stringify(ChatStreamEventSchema.parse(event))}\n`;
}

function parseLine(line: string) {
  try {
    return ChatStreamEventSchema.parse(JSON.parse(line));
  } catch {
    throw new Error('CHAT_STREAM_PROTOCOL_ERROR');
  }
}

export async function readChatEventStream(
  response: Response,
  onEvent: (event: ChatStreamEvent) => void | Promise<void>,
) {
  if (!response.ok) throw new Error(`CHAT_REQUEST_FAILED_${response.status}`);
  if (!response.body) throw new Error('CHAT_STREAM_PROTOCOL_ERROR');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) await onEvent(parseLine(trimmed));
    }
    if (done) break;
  }

  const finalLine = buffer.trim();
  if (finalLine) await onEvent(parseLine(finalLine));
}
