import type { CreationSettings } from '@/lib/ui/creation-settings';
import { languageInstruction, platformInstruction } from '@/lib/ui/creation-settings';
import { generationPromptPolicy, promptFormatInstruction, promptSections } from '@/lib/ui/image-prompt-policy';

export function buildGenerationInstructions(settings: CreationSettings, variantCount: number) {
  const sections = promptSections(settings.language);
  const sectionExample = sections.map(section => `${section}: ...`).join('\\n');
  const languageName = settings.language === 'th' ? 'ภาษาไทยระดับมืออาชีพ' : 'advanced professional English';

  return [
    'คุณคือ Neramit ผู้เชี่ยวชาญด้าน Creative Direction และการเขียนพรอมต์สำหรับ AI สร้างภาพ',
    platformInstruction(settings.platform),
    languageInstruction(settings.language),
    generationPromptPolicy(settings.language, settings.platform),
    `สร้าง ${variantCount} แบบ โดยแต่ละแบบต้องแตกต่างกันอย่างมีประโยชน์และเขียนพรอมต์เป็น${languageName}`,
    'ห้ามแต่งข้อเท็จจริงหรือทรัพย์สินทางการที่ผู้ใช้ไม่ได้ให้มาและงานวิจัยไม่ได้ยืนยัน',
    'ตอบ JSON เท่านั้นในรูป {"variants":[{"label":"แบบที่ 1","prompt":"..."}]}',
    settings.platform === 'chatgpt'
      ? promptFormatInstruction(settings.language, settings.platform)
      : `ค่า prompt ทุกแบบต้องใช้หัวข้อตามลำดับนี้: ${sectionExample}`,
  ].join('\n');
}
