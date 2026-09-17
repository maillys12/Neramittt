'use client';

export function Toast({ message, tone='info' }: { message:string; tone?:'info'|'success'|'error' }) {
  if(!message) return null;
  return <div className={`toast toast--${tone}`} role="status" aria-live="polite">{message}</div>;
}
