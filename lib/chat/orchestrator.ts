import type { CreationSettings } from '@/lib/ui/creation-settings';
import type { AssistantTurn, WorkStage } from '@/lib/chat/contracts';
import { generateResearchTurn, type ResearchGenerationInput } from '@/lib/chat/research';
import { validateAssistantTurnQuality } from '@/lib/chat/quality-gate';
import type { AIExecutionMode } from '@/lib/ai/types';

type OrchestrationInput = {
  message: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  settings: CreationSettings;
  assets: Array<{ id: string; kind: 'logo' | 'reference'; authentic: boolean; label?: string }>;
  requestId: string;
  executionMode?: AIExecutionMode;
};

type Dependencies = {
  generate: (input: ResearchGenerationInput) => Promise<AssistantTurn>;
};

const OFFICIAL_CONTEXT_RE = /(?:มหาวิทยาลัย|สำนักวิชา|คณะ|โรงพยาบาล|กระทรวง|กรม|เทศบาล|องค์การ|หน่วยงาน|บริษัท|โรงเรียน|วิทยาลัย|faculty|school|university|hospital|ministry|department|government|official|institution|company)/i;

export function isOfficialContext(message: string) {
  return OFFICIAL_CONTEXT_RE.test(message);
}

export async function runResearchChat(
  input: OrchestrationInput,
  emitStage: (stage: WorkStage) => void | Promise<void>,
  dependencies: Dependencies = { generate: generateResearchTurn },
) {
  const officialContext = isOfficialContext(input.message);
  const authenticLogoProvided = input.assets.some(asset => asset.kind === 'logo' && asset.authentic);
  const baseInput: ResearchGenerationInput = {
    ...input,
    officialContext,
    executionMode: input.executionMode ?? 'production',
  };

  await emitStage('analyzing');
  await emitStage('researching');
  if (officialContext) await emitStage('identity_check');
  await emitStage('concept');
  await emitStage('copywriting');
  await emitStage('prompting');

  let turn = await dependencies.generate(baseInput);
  await emitStage('quality_check');
  let quality = validateAssistantTurnQuality(turn, { settings: input.settings, officialContext, authenticLogoProvided });

  if (!quality.ok) {
    await emitStage('prompting');
    turn = await dependencies.generate({ ...baseInput, repairReasons: quality.reasons });
    await emitStage('quality_check');
    quality = validateAssistantTurnQuality(turn, { settings: input.settings, officialContext, authenticLogoProvided });
    if (!quality.ok) throw new Error('PROMPT_FORMAT_FAILED');
  }

  await emitStage('finalizing');
  return turn;
}
