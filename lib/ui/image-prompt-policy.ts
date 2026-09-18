import type { PromptLanguage, TargetPlatform } from '@/lib/ui/creation-settings';
import { typographyInstruction } from '@/lib/ui/creation-settings';

export const POST_OUTPUT_GUIDANCE_THAI = 'พรอมต์ด้านบนพร้อมคัดลอกไปใช้กับ AI สร้างภาพแล้ว โดยข้อความสำหรับวางบนงานจริงจะแยกออกจากพรอมต์เพื่อให้จัดวางได้ถูกต้องและอ่านง่าย';

const SECTIONS = {
  th: [
    'หัวข้อและสื่อ',
    'องค์ประกอบและรายละเอียด',
    'สีและแสง',
    'องค์ประกอบและการจัดวาง',
    'คำแนะนำพื้นที่ข้อความ',
    'พารามิเตอร์',
  ],
  en: [
    'Subject & Medium',
    'Elements & Details',
    'Colors & Lighting',
    'Composition & Layout',
    'Text Placeholder Instructions',
    'Parameters',
  ],
} as const;

export const REQUIRED_PROMPT_SECTIONS = SECTIONS.en;

const THAI_RE = /[\u0E00-\u0E7F]/;
const THAI_GLOBAL_RE = /[\u0E00-\u0E7F]/g;
const LETTER_RE = /[A-Za-z\u0E00-\u0E7F]/g;
const DIRECT_THAI_RENDER_EN_RE = /\b(?:render|write|draw|display|print|spell|add|place|include)\b[^\n]{0,100}\bthai\b[^\n]{0,50}\b(?:text|letters?|words?|typography|headline|caption|copy)\b/i;
const DIRECT_THAI_RENDER_TH_RE = /(?:เขียน|วาด|แสดง|พิมพ์|ใส่|เพิ่ม|วาง).{0,60}(?:ข้อความ|ตัวอักษร).{0,40}(?:ภาษาไทย|ไทย).{0,40}(?:ลงบนภาพ|ในภาพ)/i;
const EDIT_EXISTING_IMAGE_RE = /\b(?:edit|modify|replace|retouch|change|remove|alter)\b[^\n.]{0,120}\b(?:existing|uploaded|provided|reference|attached)\b[^\n.]{0,40}\b(?:image|photo|picture)\b/i;
const EDIT_EXISTING_IMAGE_TH_RE = /(?:แก้ไข|ดัดแปลง|แทนที่|รีทัช|เปลี่ยน|ลบ).{0,80}(?:ภาพเดิม|ภาพที่มีอยู่|ภาพที่อัปโหลด|ภาพอ้างอิง)/i;
const TEMPLATE_LIKE_LAYOUT_RE = /(?:\b(?:create|add|include|place|design|use)\b.{0,90}\b(?:visible placeholders?|blank (?:boxes|cards|buttons|labels)|empty (?:boxes|containers|panels|form fields?)|form fields?|ui-like panels?|outlined text containers?)\b|\b(?:separate|clearly defined)\b.{0,50}\b(?:blank|empty|uncluttered) (?:areas?|boxes|containers?)\b.{0,100}\b(?:each|every|individual|future text|text item)|(?:สร้าง|ใส่|เพิ่ม|วาง|ออกแบบ).{0,80}(?:กล่องเปล่า|ช่องกรอกข้อมูล|การ์ดเปล่า|ปุ่มเปล่า|กรอบข้อความเปล่า|พื้นที่ว่างแยก).{0,80}(?:แต่ละ|ทุก|ข้อความ|ข้อมูล))/i;
const FENCED_BLOCK_RE = /```(?:[a-zA-Z0-9_-]+)?\s*\n?([\s\S]*?)```/g;

const CREATIVE_DIRECTOR_RULES = [
  'Before writing a prompt, act as a creative director: identify the job type, target audience, communication objective, desired response, and the single most important message.',
  'Translate the brief into an information hierarchy before choosing visual elements. Decide what must be noticed first, second, and third.',
  'Choose one dominant visual idea and one clear focal point. Supporting elements must reinforce the communication objective instead of competing for attention.',
  'Do not turn every user detail into a visual object. Select only the few elements that communicate the message most effectively and exclude decorative keyword dumping.',
  'When a missing preference does not affect factual accuracy, legal safety, authentic identity, or the core message, make reasonable art-direction decisions yourself instead of asking another question.',
  'For posters, advertisements, announcements, covers, signs, and social graphics, describe a finished, publication-ready design—not a wireframe, form, or empty template.',
  'When copy will be overlaid later, reserve typography space through natural negative space integrated into the artwork. When the selected platform can render short copy, integrate that verified copy into the finished design instead. In both cases the composition must remain intentional, balanced, detailed, and visually complete.',
  'Unless the user explicitly requests a template or interface, prohibit visible placeholder boxes, blank cards, form fields, empty labels, outlined text containers, UI-like panels, blank buttons, pseudo-text, gibberish, and a separate empty container for each fact.',
  'For institutional or commercial work, add only useful conventions such as a headline zone, key-information treatment, CTA, contact/footer area, or authentic identity area when they serve the communication objective.',
] as const;

export function creativeDirectorInstructions() {
  return CREATIVE_DIRECTOR_RULES.join('\n');
}

export function promptFormatInstruction(language: PromptLanguage, platform: TargetPlatform) {
  if (platform === 'chatgpt') {
    return [
      'Write each final prompt as a concise natural-language instruction in 1–3 short paragraphs, similar to a capable creative director briefing ChatGPT image generation.',
      'State the finished deliverable, exact verified display copy, essential hierarchy, overall art direction, aspect ratio, and any authentic supplied asset.',
      'Do not use technical section labels, long keyword inventories, repeated constraints, prompt-engine jargon, or explain the hidden analysis.',
    ].join('\n');
  }
  return `Organize every prompt using these exact ${language === 'th' ? 'Thai' : 'English'} section labels: ${SECTIONS[language].map(section => `${section}:`).join(', ')}`;
}

export function promptSections(language: PromptLanguage) {
  return [...SECTIONS[language]];
}

export function sanitizeModelText(text: string) {
  return text
    .normalize('NFC')
    .replace(/[\u200B-\u200D\u2060\uFEFF\uFFFD]/g, '')
    .replace(/[\uE000-\uF8FF]/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

export function extractFencedPromptBlocks(text: string) {
  return [...text.matchAll(FENCED_BLOCK_RE)].map(match => match[1].trim());
}

export function hasFencedPromptBlocks(text: string) {
  return extractFencedPromptBlocks(text).length > 0;
}

export function hasOnlyFencedPromptBlocks(text: string) {
  const clean = sanitizeModelText(text);
  const outside = clean.replace(FENCED_BLOCK_RE, '').trim();
  return outside.length === 0 && extractFencedPromptBlocks(clean).length > 0;
}

function thaiCharacterRatio(text: string) {
  const letters = text.match(LETTER_RE)?.length ?? 0;
  if (letters === 0) return 0;
  return (text.match(THAI_GLOBAL_RE)?.length ?? 0) / letters;
}

export function validatePromptContent(content: string, language: PromptLanguage, platform: TargetPlatform = 'generic') {
  const reasons: string[] = [];
  const clean = sanitizeModelText(content);
  const ratio = thaiCharacterRatio(clean);

  if (language === 'th' && !THAI_RE.test(clean)) {
    reasons.push('Prompt must be written in Thai.');
  }
  if (language === 'en' && ratio > 0.15) {
    reasons.push('Prompt must be written predominantly in English; Thai is allowed only for necessary official names or supplied copy references.');
  }
  if (platform !== 'chatgpt' && (DIRECT_THAI_RENDER_EN_RE.test(clean) || DIRECT_THAI_RENDER_TH_RE.test(clean))) {
    reasons.push('Prompt instructs the image model to render Thai text directly. Reserve typography space and provide copy separately.');
  }
  if (EDIT_EXISTING_IMAGE_RE.test(clean) || EDIT_EXISTING_IMAGE_TH_RE.test(clean)) {
    reasons.push('Prompt is phrased as editing an existing image instead of generating a new image.');
  }
  if (TEMPLATE_LIKE_LAYOUT_RE.test(clean)) {
    reasons.push('Prompt creates a template-like layout with visible placeholders, form fields, or separate empty containers instead of a finished composition.');
  }
  if (platform !== 'chatgpt') {
    for (const section of SECTIONS[language]) {
      if (!clean.includes(`${section}:`)) reasons.push(`Prompt is missing the ${section} structure.`);
    }
  }

  return { ok: reasons.length === 0, reasons };
}

export function validateFinalPromptResponse(text: string, expectedCount: number, language: PromptLanguage = 'en', platform: TargetPlatform = 'generic') {
  const reasons: string[] = [];
  const clean = sanitizeModelText(text);
  const blocks = extractFencedPromptBlocks(clean);

  if (blocks.length !== expectedCount) {
    reasons.push(`Expected ${expectedCount} fenced prompt block(s), received ${blocks.length}.`);
  }
  if (!hasOnlyFencedPromptBlocks(clean)) {
    reasons.push('Final output must contain only fenced prompt code blocks with no prose outside the code blocks.');
  }
  blocks.forEach((block, index) => {
    const validation = validatePromptContent(block, language, platform);
    validation.reasons.forEach(reason => reasons.push(`Prompt ${index + 1}: ${reason}`));
  });

  return { ok: reasons.length === 0, reasons };
}

export function buildPromptRepairInstructions(expectedCount: number, language: PromptLanguage = 'en', platform: TargetPlatform = 'generic') {
  const languageRule = language === 'th'
    ? 'Write every prompt in advanced, natural, professional Thai.'
    : 'Write every prompt in advanced professional English; Thai is allowed only for a necessary official name.';
  return [
    'Repair the assistant response so it strictly follows these rules.',
    `Return exactly ${expectedCount} final image-generation prompt${expectedCount === 1 ? '' : 's'}, each in its own fenced Markdown code block.`,
    languageRule,
    'Output only the fenced prompt code block or blocks with no prose outside them.',
    'Frame the task as generating a new image from scratch, not editing an existing image.',
    'Rebuild the art direction from the communication objective, information hierarchy, and one dominant visual idea.',
    'Describe a finished composition with natural negative space integrated into the artwork, not a wireframe or empty template.',
    'Do not create visible placeholder boxes, blank cards, form fields, UI-like panels, or a separate empty container for each fact.',
    typographyInstruction(platform),
    'Never invent or approximate an official logo, seal, date, contact, qualification, or other fact.',
    promptFormatInstruction(language, platform),
    'Choose an appropriate aspect ratio and place it in the final parameters section.',
    'Do not add corrupted Unicode, replacement characters, invisible junk, or irrelevant languages.',
  ].join('\n');
}

export function generationPromptPolicy(language: PromptLanguage = 'en', platform: TargetPlatform = 'generic') {
  return [
    language === 'th'
      ? 'Write every final image-generation prompt in advanced professional Thai.'
      : 'Write every final image-generation prompt in advanced professional English.',
    'Treat the task as generating a new image from scratch, not editing an existing image.',
    creativeDirectorInstructions(),
    'Do not phrase the prompt as editing, modifying, replacing, retouching, changing, or removing content from an existing image.',
    typographyInstruction(platform),
    'Never invent or approximate official logos, seals, names, dates, contacts, qualifications, or other facts.',
    promptFormatInstruction(language, platform),
    'Choose an aspect ratio appropriate to the requested job and place it in the final parameters section.',
    'Do not output malformed Unicode, random symbols, or irrelevant languages inside prompt strings.',
  ].join('\n');
}
