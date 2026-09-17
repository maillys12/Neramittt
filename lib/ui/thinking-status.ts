const STAGES = [
  { at: 0, label: 'กำลังวิเคราะห์คำขอ' },
  { at: 2200, label: 'กำลังจัดระเบียบรายละเอียด' },
  { at: 6000, label: 'กำลังเตรียมคำตอบ' },
  { at: 10500, label: 'กำลังตรวจความครบถ้วน' },
] as const;

export function getThinkingStatus(elapsedMs: number): string {
  const elapsed = Math.max(0, elapsedMs);
  let label: string = STAGES[0].label;
  for (const stage of STAGES) {
    if (elapsed < stage.at) break;
    label = stage.label;
  }
  return label;
}
