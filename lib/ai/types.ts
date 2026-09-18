export const AI_STAGES = ['requirement','research','creative_director','final_prompt','repair'] as const;
export type AIStage = typeof AI_STAGES[number];
export type AIExecutionMode = 'production' | 'draft_test';
export const REASONING_EFFORTS = ['none','low','medium','high','xhigh','max'] as const;
export type ReasoningEffort = typeof REASONING_EFFORTS[number];

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  toolCalls?: number;
};

export type StageRuntimeConfig = {
  stage: AIStage;
  mode: 'auto' | 'manual';
  modelOverride: string | null;
  fallbackModel: string;
  reasoningEffort: ReasoningEffort;
  maxOutputTokens: number;
};

export type AIRuntimeConfig = {
  safeMode: boolean;
  autoRoutingEnabled: boolean;
  stages: Record<AIStage, StageRuntimeConfig>;
};

export type BudgetSnapshot = {
  enabled: boolean;
  monthlyBudgetThb: number;
  usedThb: number;
  remainingThb: number;
  usedPercent: number;
  periodStart: string;
  periodEnd: string;
  usdToThb: number;
};

export type PromptType = 'system' | 'creative_director';
export type PromptVersion = {
  id: string;
  promptType: PromptType;
  version: number;
  status: 'draft' | 'published' | 'archived';
  content: string;
  changeNote: string | null;
  createdAt: string;
  publishedAt: string | null;
};
