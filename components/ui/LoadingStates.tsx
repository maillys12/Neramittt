'use client';

import { NeramitIcon } from './NeramitIcon';
import type { PromptLanguage } from '@/lib/ui/creation-settings';
import type { WorkStage } from '@/lib/chat/contracts';
import { workStageLabel } from '@/lib/chat/status';

export function InlineSpinner({ label = 'กำลังโหลด' }: { label?: string }) {
  return <span className="inlineSpinner" role="status" aria-live="polite"><span className="inlineSpinner__dot" />{label}</span>;
}

export function AiThinkingBubble({ language = 'th' }: { language?: PromptLanguage }) {
  const label = language === 'en' ? 'Starting the request' : 'กำลังเริ่มดำเนินการ';
  return (
    <div className="aiThinking" role="status" aria-live="polite" aria-label={label}>
      <span className="aiAvatar" aria-hidden="true"><NeramitIcon name="spark" size={20}/></span>
      <div className="aiThinking__bubble"><span>{label}</span><span className="typingDots" aria-hidden="true"><i /><i /><i /></span></div>
    </div>
  );
}

export function WorkStatusBubble({ stage, language, elapsedSeconds = 0 }: { stage: WorkStage; language: PromptLanguage; elapsedSeconds?: number }) {
  const elapsed = elapsedSeconds >= 10 ? (language === 'en' ? `${elapsedSeconds}s elapsed` : `ผ่านไป ${elapsedSeconds} วินาที`) : '';
  const label = workStageLabel(stage, language);
  return (
    <div className="aiThinking" role="status" aria-live="polite" aria-label={label}>
      <span className="aiAvatar" aria-hidden="true"><NeramitIcon name={stage === 'researching' || stage === 'identity_check' ? 'search' : 'spark'} size={20}/></span>
      <div className="aiThinking__bubble"><span>{label}</span>{elapsed && <small>{elapsed}</small>}<span className="typingDots" aria-hidden="true"><i/><i/><i/></span></div>
    </div>
  );
}

export function LoadingOverlay({ title = 'Neramit กำลังทำงาน', detail = 'ใช้เวลาไม่นานนะ' }: { title?: string; detail?: string }) {
  return (
    <div className="loadingOverlay" role="status" aria-live="polite">
      <div className="loadingOverlay__card">
        <div className="loadingOrb" aria-hidden="true"><NeramitIcon name="spark" size={30}/></div>
        <strong>{title}</strong>
        <span>{detail}</span>
        <span className="typingDots" aria-hidden="true"><i /><i /><i /></span>
      </div>
    </div>
  );
}

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <span className={`skeleton ${className}`} aria-hidden="true" />;
}
