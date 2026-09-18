import type { PromptLanguage } from '@/lib/ui/creation-settings';

export type BriefLike = Record<string, unknown>;

const labels: Array<[string, string, string]> = [
  ['topic', 'หัวข้อ', 'Topic'],
  ['work_type', 'ประเภทงาน', 'Work type'],
  ['style', 'สไตล์', 'Style'],
  ['color', 'โทนสี', 'Color palette'],
  ['ratio', 'สัดส่วน', 'Aspect ratio'],
  ['composition', 'การจัดวาง', 'Composition'],
  ['poster_text', 'ข้อความบนโปสเตอร์', 'Poster copy'],
  ['additional_details', 'รายละเอียดเพิ่มเติม', 'Additional details'],
];

export function briefRows(brief: BriefLike, language: PromptLanguage = 'th'): Array<[string, string]> {
  return labels.flatMap(([key, thaiLabel, englishLabel]) => {
    const value = brief[key];
    if (value === null || value === undefined || value === '') return [];
    const label = language === 'en' ? englishLabel : thaiLabel;
    return [[label, String(value)] as [string, string]];
  });
}

export function chatSummaryRows(brief: BriefLike, language: PromptLanguage = 'th'): Array<[string, string]> {
  const allowed = language === 'en'
    ? ['Topic', 'Work type', 'Style', 'Color palette', 'Aspect ratio', 'Poster copy']
    : ['หัวข้อ', 'ประเภทงาน', 'สไตล์', 'โทนสี', 'สัดส่วน', 'ข้อความบนโปสเตอร์'];
  return briefRows(brief, language).filter(([label]) => allowed.includes(label));
}

export function variantTabLabel(index: number, label?: string): string {
  return `แบบที่ ${index + 1}${label ? ` · ${label}` : ''}`;
}
