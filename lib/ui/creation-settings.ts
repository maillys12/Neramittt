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

export function languageInstruction(language: PromptLanguage) {
  if (language === 'th') {
    return 'ตอบผู้ใช้และเขียนพรอมต์ฉบับสมบูรณ์เป็นภาษาไทยระดับมืออาชีพ ใช้ภาษาไทยที่เป็นธรรมชาติ ละเอียด ชัดเจน และไม่แปลตรงตัวจากภาษาอังกฤษ';
  }
  return 'Respond to the user and write every final prompt in advanced professional English. Keep all user-facing messages, reply cards, copy suggestions, and recommendations in English.';
}

export function typographyInstruction(platform: TargetPlatform) {
  if (platform === 'chatgpt') {
    return 'ChatGPT image generation may render short verified display copy such as a headline, key number, date, or brief CTA when it makes the finished design more useful. Include only copy supplied by the user or clearly labeled as suggested copy, keep it short, specify the exact wording, and require the result to proofread every visible character. Keep long body copy, detailed contacts, terms, and unverified facts separate for overlay later.';
  }
  return 'Treat raster typography as unreliable: provide exact copy separately and reserve integrated natural space to overlay later. Do not ask the image model to render long, exact, or important Thai copy.';
}
