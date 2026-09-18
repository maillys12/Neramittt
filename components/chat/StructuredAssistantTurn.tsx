'use client';

import type { AssistantTurn } from '@/lib/chat/contracts';
import type { PromptLanguage } from '@/lib/ui/creation-settings';
import type { SmartReplySelection } from '@/lib/chat/smart-replies';
import { NeramitIcon } from '@/components/ui/NeramitIcon';
import { SmartReplyCards } from '@/components/chat/SmartReplyCards';

type Props = {
  turn: AssistantTurn;
  language: PromptLanguage;
  replyDisabled: boolean;
  selectedOptionId?: string;
  onReply: (selection: SmartReplySelection) => void;
  onCopy: (text: string) => void;
};

const labels = {
  th: {
    prompt: 'พรอมต์พร้อมใช้', copy: 'คัดลอก', copyIdeas: 'ข้อความที่แนะนำ', missing: 'ข้อมูลที่ยังต้องระบุ',
    include: 'สิ่งที่ควรใส่', exclude: 'สิ่งที่ไม่ควรใส่', sources: 'แหล่งข้อมูลที่ใช้ตรวจสอบ', warnings: 'ข้อควรทราบ',
  },
  en: {
    prompt: 'Ready-to-use prompt', copy: 'Copy', copyIdeas: 'Suggested copy', missing: 'Information still needed',
    include: 'What to include', exclude: 'What to avoid', sources: 'Research sources', warnings: 'Important notes',
  },
} as const;

export function StructuredAssistantTurn({ turn, language, replyDisabled, selectedOptionId, onReply, onCopy }: Props) {
  const text = labels[language];
  if (turn.type === 'question') {
    return <div className="structuredTurn">
      <div className="assistantText">{turn.message}</div>
      {turn.interaction && <SmartReplyCards
        options={turn.interaction.options}
        language={language}
        disabled={replyDisabled}
        selectedOptionId={selectedOptionId}
        onSelect={onReply}
      />}
    </div>;
  }

  const copyRows = [turn.copySuggestions.headline, turn.copySuggestions.subheadline, ...(turn.copySuggestions.body ?? []), turn.copySuggestions.cta].filter((value): value is string => Boolean(value));
  return <div className="structuredTurn structuredTurn--final">
    <div className="assistantText">{turn.message}</div>
    <div className="promptResults">
      {turn.prompts.map(prompt => <section className="promptCodeBlock" key={prompt.id}>
        <div className="promptCodeHeader"><span>{prompt.label || text.prompt}</span><button type="button" onClick={() => onCopy(prompt.content)}><NeramitIcon name="document" size={16}/>{text.copy}</button></div>
        <pre><code>{prompt.content}</code></pre>
      </section>)}
    </div>
    {copyRows.length > 0 && <section className="turnDetailCard"><h3><NeramitIcon name="edit" size={18}/>{text.copyIdeas}</h3><ul>{copyRows.map((row, index) => <li key={`${row}-${index}`}>{row}</li>)}</ul></section>}
    {turn.copySuggestions.missingFacts.length > 0 && <section className="turnDetailCard turnDetailCard--notice"><h3><NeramitIcon name="search" size={18}/>{text.missing}</h3><ul>{turn.copySuggestions.missingFacts.map(item => <li key={item}>{item}</li>)}</ul></section>}
    {(turn.recommendations.include.length > 0 || turn.recommendations.exclude.length > 0) && <div className="recommendationGrid">
      {turn.recommendations.include.length > 0 && <section className="turnDetailCard"><h3><NeramitIcon name="check" size={18}/>{text.include}</h3><ul>{turn.recommendations.include.map(row => <li key={`${row.item}-${row.reason}`}><strong>{row.item}</strong><span>{row.reason}</span></li>)}</ul></section>}
      {turn.recommendations.exclude.length > 0 && <section className="turnDetailCard"><h3><NeramitIcon name="close" size={18}/>{text.exclude}</h3><ul>{turn.recommendations.exclude.map(row => <li key={`${row.item}-${row.reason}`}><strong>{row.item}</strong><span>{row.reason}</span></li>)}</ul></section>}
    </div>}
    {turn.warnings.length > 0 && <section className="turnDetailCard turnDetailCard--warning"><h3><NeramitIcon name="lock" size={18}/>{text.warnings}</h3><ul>{turn.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></section>}
    {turn.sources.length > 0 && <section className="researchSources"><h3><NeramitIcon name="globe" size={18}/>{text.sources}</h3><div>{turn.sources.map(source => <a href={source.url} target="_blank" rel="noreferrer" key={source.url}><span>{source.title}</span><small>{source.domain}</small></a>)}</div></section>}
  </div>;
}
