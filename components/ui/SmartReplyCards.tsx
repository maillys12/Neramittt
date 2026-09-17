'use client';

import { FormEvent, useState } from 'react';
import styles from './SmartReplyCards.module.css';

type Props = {
  options: string[];
  disabled?: boolean;
  onSelect: (value: string) => void;
  onCustomSubmit: (value: string) => void;
};

export function SmartReplyCards({ options, disabled = false, onSelect, onCustomSubmit }: Props) {
  const [customOpen, setCustomOpen] = useState(false);
  const [custom, setCustom] = useState('');

  if (!options.length) return null;

  function submitCustom(event: FormEvent) {
    event.preventDefault();
    const value = custom.trim();
    if (!value || disabled) return;
    onCustomSubmit(value);
    setCustom('');
    setCustomOpen(false);
  }

  return (
    <div className={styles.wrap} aria-label="คำตอบแนะนำ">
      <span className={styles.label}>ตอบได้เร็วขึ้น</span>
      <div className={styles.grid}>
        {options.map(option => (
          <button key={option} type="button" className={styles.card} disabled={disabled} onClick={() => onSelect(option)}>
            {option}
          </button>
        ))}
        <button type="button" className={`${styles.card} ${styles.other}`} disabled={disabled} onClick={() => setCustomOpen(value => !value)}>
          อื่น ๆ
        </button>
      </div>
      {customOpen && (
        <form className={styles.customForm} onSubmit={submitCustom}>
          <input autoFocus value={custom} onChange={event => setCustom(event.target.value)} placeholder="พิมพ์คำตอบของคุณ..." disabled={disabled} />
          <button type="submit" disabled={disabled || !custom.trim()}>ส่ง</button>
        </form>
      )}
    </div>
  );
}
