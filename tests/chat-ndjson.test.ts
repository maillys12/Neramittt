import { describe, expect, it } from 'vitest';
import { encodeChatEvent, readChatEventStream } from '@/lib/chat/ndjson';
import type { ChatStreamEvent } from '@/lib/chat/contracts';

function responseFromChunks(chunks: string[], status = 200) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach(chunk => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  });
  return new Response(stream, { status, headers: { 'content-type': 'application/x-ndjson' } });
}

describe('NDJSON chat codec', () => {
  it('parses events split across arbitrary network chunks', async () => {
    const events: ChatStreamEvent[] = [];
    const response = responseFromChunks([
      '{"type":"stage",',
      '"stage":"researching"}\n{"type":"done",',
      '"requestId":"c9da29d5-06f8-4a58-8fe3-762dd33ff839"}\n',
    ]);

    await readChatEventStream(response, event => { events.push(event); });

    expect(events.map(event => event.type)).toEqual(['stage', 'done']);
    expect(events[0]).toEqual({ type: 'stage', stage: 'researching' });
  });

  it('encodes exactly one validated event per line', () => {
    expect(encodeChatEvent({ type: 'stage', stage: 'quality_check' })).toBe(
      '{"type":"stage","stage":"quality_check"}\n',
    );
  });

  it('rejects malformed protocol events instead of silently skipping them', async () => {
    const response = responseFromChunks(['{"type":"stage","stage":"fake"}\n']);
    await expect(readChatEventStream(response, () => undefined)).rejects.toThrow('CHAT_STREAM_PROTOCOL_ERROR');
  });

  it('surfaces a useful error for a non-stream HTTP failure', async () => {
    const response = responseFromChunks(['{"error":"denied"}'], 403);
    await expect(readChatEventStream(response, () => undefined)).rejects.toThrow('CHAT_REQUEST_FAILED_403');
  });
});
