'use client';

import type { SVGProps } from 'react';

export type NeramitIconName = 'chat'|'document'|'globe'|'layers'|'search'|'edit'|'lock'|'image'|'settings'|'history'|'refresh'|'send'|'spark'|'user'|'chevronDown'|'chevronLeft'|'chevronRight'|'upload'|'palette'|'check'|'close';

type Props = { name: NeramitIconName; size?: number; className?: string } & Omit<SVGProps<SVGSVGElement>, 'name'>;

const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export function NeramitIcon({ name, size = 20, className, ...props }: Props) {
  const paths: Record<NeramitIconName, React.ReactNode> = {
    chat: <><path d="M5 5.5h14a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-7l-5 3v-3H5a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3Z"/><path d="M7.5 11h.01M12 11h.01M16.5 11h.01"/></>,
    document: <><path d="M6 3h8l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5M8 12h8M8 16h6"/></>,
    globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.3 2.6 3.5 5.6 3.5 9S14.3 18.4 12 21c-2.3-2.6-3.5-5.6-3.5-9S9.7 5.6 12 3Z"/></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    edit: <><path d="M4 20h4l11-11-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></>,
    image: <><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 16-5.5-5.5L8 18"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.86 2.86-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.86-2.86.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06L7.06 3.8l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.86 2.86-.06.06A1.7 1.7 0 0 0 19.4 9c.13.38.34.72.6 1 .28.3.67.45 1.1.45H21v4h-.1A1.7 1.7 0 0 0 19.4 15Z"/></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
    refresh: <><path d="M20 6v5h-5M4 18v-5h5"/><path d="M18.5 11a7 7 0 0 0-12-4L4 9M5.5 13a7 7 0 0 0 12 4L20 15"/></>,
    send: <><path d="m3 11 18-8-8 18-2-7-8-3Z"/><path d="m11 14 4-4"/></>,
    spark: <><path d="m12 2 1.7 4.3L18 8l-4.3 1.7L12 14l-1.7-4.3L6 8l4.3-1.7L12 2Z"/><path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    chevronDown: <path d="m6 9 6 6 6-6"/>,
    chevronLeft: <path d="m15 6-6 6 6 6"/>,
    chevronRight: <path d="m9 6 6 6-6 6"/>,
    upload: <><path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 20h14"/></>,
    palette: <><path d="M12 3a9 9 0 1 0 0 18h2a2 2 0 0 0 0-4h-1a2 2 0 0 1-2-2c0-1.1.9-2 2-2h2a6 6 0 0 0-3-10Z"/><circle cx="7.5" cy="9" r=".8"/><circle cx="10" cy="6.5" r=".8"/><circle cx="15" cy="7.5" r=".8"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
  };
  return <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className={className} {...common} {...props}>{paths[name]}</svg>;
}
