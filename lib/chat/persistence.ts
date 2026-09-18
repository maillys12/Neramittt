import type { PromptLanguage } from '@/lib/ui/creation-settings';
import type { AssistantTurn, ChatErrorCode, ChatStreamEvent } from '@/lib/chat/contracts';

export function assistantTurnContent(turn: AssistantTurn) {
  if (turn.type === 'question') return turn.message;
  return [turn.message, ...turn.prompts.map(prompt => `${prompt.label}\n${prompt.content}`)].join('\n\n');
}

export function assistantTurnMetadata(turn: AssistantTurn, requestId: string) {
  return { version: 2, requestId, turn } as const;
}

const safeMessages: Record<ChatErrorCode, Record<PromptLanguage, string>> = {
  CHAT_FAILED: {
    th: 'เนรมิตยังทำคำขอนี้ไม่สำเร็จ กรุณาลองอีกครั้ง',
    en: 'Neramit could not complete this request. Please try again.',
  },
  RESEARCH_FAILED: {
    th: 'ค้นคว้าข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง',
    en: 'Research could not be completed. Please try again.',
  },
  PROMPT_FORMAT_FAILED: {
    th: 'ตรวจสอบรูปแบบพรอมต์ไม่ผ่าน กรุณาลองสร้างอีกครั้ง',
    en: 'The prompt did not pass quality checks. Please generate it again.',
  },
  STREAM_INTERRUPTED: {
    th: 'การเชื่อมต่อขาดช่วง กรุณาลองส่งอีกครั้ง',
    en: 'The connection was interrupted. Please try again.',
  },
  MODEL_CAPABILITY_UNAVAILABLE: {
    th: 'โมเดลที่ตั้งค่าไว้ยังไม่รองรับการค้นคว้า กรุณาติดต่อผู้ดูแลระบบ',
    en: 'The configured model does not support research. Please contact the administrator.',
  },
};

export function serializeChatError(error: unknown, language: PromptLanguage): ChatStreamEvent {
  const raw = error instanceof Error ? error.message : 'CHAT_FAILED';
  const code: ChatErrorCode = raw === 'RESEARCH_FAILED'
    || raw === 'PROMPT_FORMAT_FAILED'
    || raw === 'STREAM_INTERRUPTED'
    || raw === 'MODEL_CAPABILITY_UNAVAILABLE'
    ? raw
    : 'CHAT_FAILED';
  return {
    type: 'error',
    code,
    message: safeMessages[code][language],
    retryable: code !== 'MODEL_CAPABILITY_UNAVAILABLE',
  };
}
