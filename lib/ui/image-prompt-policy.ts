export const FINAL_THAI_REMARK = 'กรุณานำพรอมต์นี้ไปใช้สร้างภาพ และนำภาพที่ได้ไปพิมพ์ข้อความภาษาไทยทับเองในแอปพลิเคชันอื่น';

export const REQUIRED_PROMPT_SECTIONS = [
  'Subject & Medium',
  'Elements & Details',
  'Colors & Lighting',
  'Composition & Layout',
  'Parameters',
] as const;

const THAI_RE = /[\u0E00-\u0E7F]/;
const DIRECT_THAI_RENDER_RE = /\b(?:render|write|draw|display|print|spell|add|place|include)\b[^\n]{0,80}\bthai\b[^\n]{0,40}\b(?:text|letters?|words?|typography|headline|caption|copy)\b/i;

export function sanitizeModelText(text: string) {
  return text
    .normalize('NFC')
    .replace(/[\u200B-\u200D\u2060\uFEFF\uFFFD]/g, '')
    .replace(/[\uE000-\uF8FF]/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

export function extractFencedPromptBlocks(text: string) {
  return [...text.matchAll(/```(?:[a-zA-Z0-9_-]+)?\s*\n?([\s\S]*?)```/g)].map((match) => match[1].trim());
}

export function hasFencedPromptBlocks(text: string) {
  return extractFencedPromptBlocks(text).length > 0;
}

export function appendExactFinalRemark(text: string) {
  const clean = sanitizeModelText(text);
  const withoutExisting = clean.replace(/\n*กรุณานำพรอมต์นี้ไปใช้สร้างภาพ[\s\S]*$/u, '').trim();
  return `${withoutExisting}\n\n${FINAL_THAI_REMARK}`;
}

export function validateFinalPromptResponse(text: string, expectedCount: number) {
  const reasons: string[] = [];
  const blocks = extractFencedPromptBlocks(text);

  if (blocks.length !== expectedCount) {
    reasons.push(`Expected ${expectedCount} fenced prompt block(s), received ${blocks.length}.`);
  }

  blocks.forEach((block, index) => {
    if (THAI_RE.test(block)) reasons.push(`Prompt ${index + 1} contains Thai characters.`);
    if (DIRECT_THAI_RENDER_RE.test(block)) reasons.push(`Prompt ${index + 1} instructs the image model to render Thai text.`);
    for (const section of REQUIRED_PROMPT_SECTIONS) {
      if (!block.includes(`${section}:`)) reasons.push(`Prompt ${index + 1} is missing the ${section} structure.`);
    }
  });

  if (!sanitizeModelText(text).endsWith(FINAL_THAI_REMARK)) {
    reasons.push('The exact required Thai remark is missing from the end of the response.');
  }

  return { ok: reasons.length === 0, reasons };
}

export function buildPromptRepairInstructions(expectedCount: number) {
  return [
    'Repair the assistant response so it strictly follows these rules.',
    `Return exactly ${expectedCount} final image-generation prompt${expectedCount === 1 ? '' : 's'}, each in its own fenced Markdown code block.`,
    'Every prompt inside a code block must be entirely in English. No Thai characters are allowed inside code blocks.',
    'Never instruct the image model to render, write, draw, display, print, spell, add, or place Thai text in the image.',
    'If Thai copy is requested, convert it to layout instructions such as: leave blank space for text, negative space for typography, clean background for later text overlay, or reserve space for headline and supporting text.',
    'Each code block must use these exact section labels: Subject & Medium:, Elements & Details:, Colors & Lighting:, Composition & Layout:, Text Placeholder Instructions: when relevant, and Parameters: at the end.',
    'Use an appropriate aspect ratio in Parameters, for example --ar 9:16, --ar 4:5, --ar 1:1, or --ar 16:9 depending on the job.',
    `After all code blocks, end with exactly this Thai sentence and nothing after it: ${FINAL_THAI_REMARK}`,
    'Do not add unrelated languages, corrupted Unicode, replacement characters, decorative junk, or strange symbols.',
  ].join('\n');
}

export function generationPromptPolicy() {
  return [
    'Every final image-generation prompt string must be written entirely in English.',
    'Never instruct the image model to render Thai text directly into the image.',
    'If the user supplied Thai wording, convert it into composition guidance only: leave blank space for text, negative space for typography, clean background for later text overlay, or reserve space for headline/supporting copy.',
    'Organize every prompt using: Subject & Medium; Elements & Details; Colors & Lighting; Composition & Layout; Text Placeholder Instructions when relevant; Parameters.',
    'Choose an aspect ratio appropriate to the requested job and place it in Parameters.',
    'Do not invent facts, names, dates, prices, or wording that the user did not provide.',
    'Do not output malformed Unicode, random symbols, or irrelevant languages inside prompt strings.',
  ].join('\n');
}
