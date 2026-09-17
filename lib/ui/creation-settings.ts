export type TargetPlatform = 'chatgpt' | 'gemini' | 'canva' | 'generic';
export type PromptLanguage = 'th' | 'en';
export type VariantCount = 1 | 2 | 3;
export type CreationSettings = { platform: TargetPlatform; language: PromptLanguage; variantCount: VariantCount };

type BriefLike = Record<string, unknown> | null | undefined;

const platforms: TargetPlatform[] = ['chatgpt', 'gemini', 'canva', 'generic'];
const languages: PromptLanguage[] = ['th', 'en'];
const counts: VariantCount[] = [1, 2, 3];

export function normalizeCreationSettings(brief: BriefLike): CreationSettings {
  const platform = platforms.includes(brief?.target_platform as TargetPlatform) ? brief?.target_platform as TargetPlatform : 'chatgpt';
  const language = languages.includes(brief?.prompt_language as PromptLanguage) ? brief?.prompt_language as PromptLanguage : 'th';
  const rawCount = Number(brief?.variant_count);
  const variantCount = counts.includes(rawCount as VariantCount) ? rawCount as VariantCount : 1;
  return { platform, language, variantCount };
}

export function settingsPatch(settings: CreationSettings) {
  return {
    target_platform: settings.platform,
    prompt_language: settings.language,
    variant_count: settings.variantCount,
  } as const;
}

export function platformInstruction(platform: TargetPlatform) {
  if (platform === 'chatgpt') return 'จัดรูปแบบพรอมต์ให้เหมาะกับ ChatGPT / OpenAI image generation: ชัดเจน เป็นธรรมชาติ และระบุองค์ประกอบภาพเป็นลำดับ';
  if (platform === 'gemini') return 'จัดรูปแบบพรอมต์ให้เหมาะกับ Gemini: ใช้ภาษาธรรมชาติที่ให้บริบทครบและเชื่อมโยงองค์ประกอบภาพอย่างชัดเจน';
  if (platform === 'canva') return 'จัดรูปแบบพรอมต์ให้เหมาะกับ Canva AI: กระชับ เน้นสไตล์ องค์ประกอบ สี และการจัดวางที่สำคัญ';
  return 'จัดเป็นพรอมต์กลางที่นำไปใช้กับ AI สร้างภาพหลายแพลตฟอร์มได้ โดยไม่ผูกกับ syntax เฉพาะราย';
}

export function languageInstruction(_language: PromptLanguage) {
  return 'Write every final image-generation prompt entirely in English. Conversation/UI language must never cause Thai text to appear inside the final image prompt.';
}
