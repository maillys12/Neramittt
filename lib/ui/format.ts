export type BriefLike = Record<string, unknown>;

const labels: Array<[string, string]> = [
  ['topic', 'หัวข้อ'],
  ['work_type', 'ประเภทงาน'],
  ['style', 'สไตล์'],
  ['color', 'โทนสี'],
  ['ratio', 'สัดส่วน'],
  ['composition', 'การจัดวาง'],
  ['poster_text', 'ข้อความบนโปสเตอร์'],
  ['additional_details', 'รายละเอียดเพิ่มเติม'],
];

export function briefRows(brief: BriefLike): Array<[string, string]> {
  return labels.flatMap(([key, label]) => {
    const value = brief[key];
    if (value === null || value === undefined || value === '') return [];
    return [[label, String(value)] as [string, string]];
  });
}

export function chatSummaryRows(brief: BriefLike): Array<[string, string]> {
  return briefRows(brief).filter(([label]) => ['หัวข้อ', 'ประเภทงาน', 'สไตล์', 'โทนสี', 'สัดส่วน', 'ข้อความบนโปสเตอร์'].includes(label));
}

export function variantTabLabel(index: number, label?: string): string {
  return `แบบที่ ${index + 1}${label ? ` · ${label}` : ''}`;
}
