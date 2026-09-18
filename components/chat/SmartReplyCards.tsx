'use client';

import { useState } from 'react';
import type { PromptLanguage } from '@/lib/ui/creation-settings';
import type { SmartReplyOption } from '@/lib/chat/contracts';
import { buildSmartReplyMessage, type SmartReplySelection } from '@/lib/chat/smart-replies';
import { NeramitIcon } from '@/components/ui/NeramitIcon';

type Props = {
  options: SmartReplyOption[];
  language: PromptLanguage;
  disabled: boolean;
  selectedOptionId?: string;
  onSelect: (selection: SmartReplySelection) => void;
};

export function SmartReplyCards({ options, language, disabled, selectedOptionId, onSelect }: Props) {
  const [customOption, setCustomOption] = useState<SmartReplyOption | null>(null);
  const [customValue, setCustomValue] = useState('');
  const customPlaceholder = language === 'en' ? 'Type your answer...' : 'พิมพ์คำตอบของคุณ...';
  const submitLabel = language === 'en' ? 'Submit' : 'ส่งคำตอบ';

  return <div className="smartReplyGroup" aria-label={language === 'en' ? 'Suggested replies' : 'คำตอบที่แนะนำ'}>
    <div className="smartReplyGrid">
      {options.map(option => <button
        type="button"
        className={`smartReplyCard${selectedOptionId === option.id ? ' isSelected' : ''}`}
        key={option.id}
        disabled={disabled}
        aria-pressed={selectedOptionId === option.id}
        onClick={() => {
          if (option.kind === 'custom') {
            setCustomOption(option);
            return;
          }
          onSelect(buildSmartReplyMessage(option));
        }}
      >
        <span>{option.label}</span>
        {selectedOptionId === option.id ? <NeramitIcon name="check" size={17}/> : <NeramitIcon name="chevronRight" size={17}/>}
      </button>)}
    </div>
    {customOption && !disabled && <form className="customReply" onSubmit={event => {
      event.preventDefault();
      if (!customValue.trim()) return;
      onSelect(buildSmartReplyMessage(customOption, customValue));
    }}>
      <input autoFocus value={customValue} onChange={event => setCustomValue(event.target.value)} placeholder={customPlaceholder} maxLength={500}/>
      <button type="submit" disabled={!customValue.trim()}>{submitLabel}<NeramitIcon name="send" size={16}/></button>
    </form>}
  </div>;
}
