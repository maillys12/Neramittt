import { z } from 'zod';

export const PromptLanguageSchema = z.enum(['th', 'en']);
export const WorkStageSchema = z.enum([
  'analyzing',
  'researching',
  'identity_check',
  'concept',
  'copywriting',
  'prompting',
  'quality_check',
  'finalizing',
]);

export const SourceRefSchema = z.object({
  title: z.string().trim().min(1).max(300),
  url: z.string().url(),
  domain: z.string().trim().min(1).max(255),
  sourceType: z.enum(['official', 'primary', 'secondary']),
}).strict();

export const SmartReplyOptionSchema = z.object({
  id: z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/),
  label: z.string().trim().min(1).max(120),
  value: z.string().max(500),
  kind: z.enum(['choice', 'custom']),
}).strict();

export const ChatInteractionSchema = z.object({
  type: z.literal('single_choice'),
  options: z.array(SmartReplyOptionSchema).min(2).max(5),
  allowCustom: z.boolean(),
}).strict().superRefine((interaction, ctx) => {
  const ids = interaction.options.map(option => option.id);
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Smart reply option IDs must be unique.' });
  }
  const customCount = interaction.options.filter(option => option.kind === 'custom').length;
  if (customCount > 1 || (interaction.allowCustom && customCount !== 1) || (!interaction.allowCustom && customCount !== 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Custom option must match allowCustom.' });
  }
});

export const RecommendationSchema = z.object({
  item: z.string().trim().min(1).max(500),
  reason: z.string().trim().min(1).max(1000),
}).strict();

export const QuestionTurnSchema = z.object({
  type: z.literal('question'),
  message: z.string().trim().min(1).max(5000),
  interaction: ChatInteractionSchema.optional(),
  briefPatch: z.record(z.unknown()),
}).strict();

export const FinalTurnSchema = z.object({
  type: z.literal('final'),
  message: z.string().trim().min(1).max(5000),
  prompts: z.array(z.object({
    id: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1).max(160),
    content: z.string().trim().min(1).max(20000),
  }).strict()).min(1).max(3),
  copySuggestions: z.object({
    headline: z.string().trim().min(1).max(500).optional(),
    subheadline: z.string().trim().min(1).max(1000).optional(),
    body: z.array(z.string().trim().min(1).max(1000)).max(12).optional(),
    cta: z.string().trim().min(1).max(500).optional(),
    missingFacts: z.array(z.string().trim().min(1).max(500)).max(20),
  }).strict(),
  recommendations: z.object({
    include: z.array(RecommendationSchema).max(20),
    exclude: z.array(RecommendationSchema).max(20),
  }).strict(),
  sources: z.array(SourceRefSchema).max(20),
  warnings: z.array(z.string().trim().min(1).max(1000)).max(20),
  briefPatch: z.record(z.unknown()),
}).strict();

export const AssistantTurnSchema = z.discriminatedUnion('type', [QuestionTurnSchema, FinalTurnSchema]);

export const ChatErrorCodeSchema = z.enum([
  'CHAT_FAILED',
  'RESEARCH_FAILED',
  'PROMPT_FORMAT_FAILED',
  'STREAM_INTERRUPTED',
  'MODEL_CAPABILITY_UNAVAILABLE',
  'AI_PAUSED',
  'AI_STAGE_DISABLED',
]);

export const ChatStreamEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('stage'), stage: WorkStageSchema }).strict(),
  z.object({ type: z.literal('turn'), turn: AssistantTurnSchema }).strict(),
  z.object({
    type: z.literal('error'),
    code: ChatErrorCodeSchema,
    message: z.string().trim().min(1).max(1000),
    retryable: z.boolean(),
  }).strict(),
  z.object({ type: z.literal('done'), requestId: z.string().uuid() }).strict(),
]);

export const CreationSettingsSchema = z.object({
  platform: z.enum(['chatgpt', 'gemini', 'canva', 'generic']),
  language: PromptLanguageSchema,
  variantCount: z.union([z.literal(1), z.literal(2), z.literal(3)]),
}).strict();

export const ChatRequestSchema = z.object({
  draftId: z.string().uuid(),
  requestId: z.string().uuid(),
  message: z.string().trim().min(1).max(5000),
  settings: CreationSettingsSchema.optional(),
  selection: z.object({
    optionId: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1).max(120),
    value: z.string().max(500),
  }).strict().optional(),
  assets: z.array(z.object({
    id: z.string().trim().min(1).max(160),
    kind: z.enum(['logo', 'reference']),
    authentic: z.boolean(),
    label: z.string().trim().min(1).max(200).optional(),
  }).strict()).max(4).optional(),
}).strict();

export type WorkStage = z.infer<typeof WorkStageSchema>;
export type SourceRef = z.infer<typeof SourceRefSchema>;
export type SmartReplyOption = z.infer<typeof SmartReplyOptionSchema>;
export type ChatInteraction = z.infer<typeof ChatInteractionSchema>;
export type AssistantTurn = z.infer<typeof AssistantTurnSchema>;
export type ChatStreamEvent = z.infer<typeof ChatStreamEventSchema>;
export type ChatErrorCode = z.infer<typeof ChatErrorCodeSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
