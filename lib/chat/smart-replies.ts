import type { SmartReplyOption } from '@/lib/chat/contracts';

export type SmartReplySelection = {
  optionId: string;
  label: string;
  value: string;
};

export function buildSmartReplyMessage(option: SmartReplyOption, customText?: string): SmartReplySelection {
  const custom = customText?.trim();
  if (option.kind === 'custom' && custom) {
    return { optionId: option.id, label: custom, value: custom };
  }
  return { optionId: option.id, label: option.label, value: option.value };
}

export function isReplyGroupActive(
  groupIndex: number,
  lastMessageIndex: number,
  selected: boolean,
  busy: boolean,
) {
  return groupIndex === lastMessageIndex && !selected && !busy;
}
