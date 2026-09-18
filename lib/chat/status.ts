import type { PromptLanguage } from '@/lib/ui/creation-settings';
import type { WorkStage } from '@/lib/chat/contracts';

const labels: Record<WorkStage, Record<PromptLanguage, string>> = {
  analyzing: { th: 'กำลังวิเคราะห์คำขอ', en: 'Analyzing your request' },
  researching: { th: 'กำลังค้นคว้าข้อมูลที่เกี่ยวข้อง', en: 'Researching relevant information' },
  identity_check: { th: 'กำลังตรวจสอบอัตลักษณ์และแหล่งข้อมูลทางการ', en: 'Checking official identity and sources' },
  concept: { th: 'กำลังวางแนวคิดและลำดับข้อมูล', en: 'Developing the concept and hierarchy' },
  copywriting: { th: 'กำลังร่างข้อความที่เหมาะสม', en: 'Drafting suitable copy' },
  prompting: { th: 'กำลังเขียนพรอมต์ฉบับสมบูรณ์', en: 'Writing the complete prompt' },
  quality_check: { th: 'กำลังตรวจสอบความถูกต้องและคุณภาพ', en: 'Checking accuracy and quality' },
  finalizing: { th: 'กำลังจัดเตรียมคำตอบ', en: 'Preparing the response' },
};

export function workStageLabel(stage: WorkStage, language: PromptLanguage) {
  return labels[stage][language];
}
