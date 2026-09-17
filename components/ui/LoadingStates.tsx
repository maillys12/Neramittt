'use client';

import { NeramitIcon } from './NeramitIcon';

export function InlineSpinner({ label = 'กำลังโหลด' }: { label?: string }) {
  return <span className="inlineSpinner" role="status" aria-live="polite"><span className="inlineSpinner__dot" />{label}</span>;
}

export function AiThinkingBubble({ label = 'กำลังคิด' }: { label?: string }) {
  return (
    <div className="aiThinking" role="status" aria-live="polite" aria-label={`Neramit ${label}`}>
      <span className="aiAvatar" aria-hidden="true"><NeramitIcon name="spark" size={20}/></span>
      <div className="aiThinking__bubble"><span>{label}</span><span className="typingDots" aria-hidden="true"><i /><i /><i /></span></div>
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
