import type { CreationSettings } from '@/lib/ui/creation-settings';
import { validatePromptContent } from '@/lib/ui/image-prompt-policy';
import type { AssistantTurn } from '@/lib/chat/contracts';

type QualityContext = {
  settings: CreationSettings;
  officialContext: boolean;
  authenticLogoProvided: boolean;
};

const RESERVED_OFFICIAL_ASSET_RE = /(?:reserve|reserved|leave|space).{0,80}(?:official\s+)?(?:logo|seal|emblem)|(?:เว้น|สำรอง|พื้นที่).{0,80}(?:โลโก้|ตรา|สัญลักษณ์)/i;

export function validateAssistantTurnQuality(turn: AssistantTurn, context: QualityContext) {
  const reasons: string[] = [];
  if (turn.type === 'question') return { ok: true, reasons };

  if (turn.prompts.length !== context.settings.variantCount) {
    reasons.push(`Expected ${context.settings.variantCount} prompt variants, received ${turn.prompts.length}.`);
  }

  turn.prompts.forEach((prompt, index) => {
    const validation = validatePromptContent(prompt.content, context.settings.language, context.settings.platform);
    validation.reasons.forEach(reason => reasons.push(`Prompt ${index + 1}: ${reason}`));
  });

  if (context.officialContext && !context.authenticLogoProvided) {
    const reservesOfficialSpace = turn.prompts.every(prompt => RESERVED_OFFICIAL_ASSET_RE.test(prompt.content));
    const warnsAboutAsset = turn.warnings.some(warning => /(?:authentic|official|supply|provide|แนบ|ไฟล์จริง|ทางการ).{0,80}(?:logo|seal|emblem|โลโก้|ตรา|สัญลักษณ์)|(?:logo|seal|emblem|โลโก้|ตรา|สัญลักษณ์).{0,80}(?:authentic|official|supply|provide|แนบ|ไฟล์จริง|ทางการ)/i.test(warning));
    if (!reservesOfficialSpace || !warnsAboutAsset) {
      reasons.push('Official work without an authentic asset must reserve official logo space and warn the user to supply the authentic asset.');
    }
  }

  return { ok: reasons.length === 0, reasons };
}
