# Admin AI Control Plane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Neramit model routing and production prompt configuration safely controllable from Admin while retaining known-good code fallbacks.

**Architecture:** Add database-backed runtime configuration and prompt versioning behind server-only resolvers. Production requests use published configuration through a short-lived cache; manual overrides and Auto Routing feed a single model resolver. Prompt editing follows Draft → Test → Compare → Publish and never lets a draft leak into live traffic.

**Tech Stack:** Next.js 15, React 19, TypeScript 5.9, Supabase/Postgres, OpenAI Node SDK 5.x, Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-19-admin-ai-control-center-design.md`

## Global Constraints

- Phase 1 observability must already exist and be verified.
- Keep owner-only Admin authentication.
- Model/reasoning/token changes may apply immediately after owner confirmation.
- System and Creative Director prompts require Draft → Test → Publish.
- Production may use only Published prompt versions.
- Known-good model and prompt defaults remain in code.
- Do not expose unpublished prompt content to user-facing APIs.
- Do not deploy until the user explicitly approves deployment.

---

## File Structure

Create:
- `supabase/migrations/202609190002_ai_control_plane.sql`
- `lib/ai/config.ts` — load/cache active runtime config.
- `lib/ai/model-router.ts` — stage-aware Auto/Manual/fallback resolver.
- `lib/ai/prompts.ts` — published/draft prompt access and publish/rollback transactions.
- `lib/ai/safe-defaults.ts` — known-good code defaults.
- `app/api/admin/ai/models/route.ts`
- `app/api/admin/ai/prompts/route.ts`
- `app/api/admin/ai/prompts/draft/route.ts`
- `app/api/admin/ai/prompts/test/route.ts`
- `app/api/admin/ai/prompts/publish/route.ts`
- `app/api/admin/ai/prompts/rollback/route.ts`
- `components/admin/AIModelsTab.tsx`
- `components/admin/AIPromptsTab.tsx`
- `components/admin/PromptTestPlayground.tsx`
- `tests/ai-model-router.test.ts`
- `tests/ai-prompts.test.ts`
- `tests/admin-ai-models-route.test.ts`
- `tests/admin-ai-prompts-route.test.ts`

Modify:
- `lib/chat/research.ts`
- `app/api/chat/route.ts`
- `lib/ui/chat-instructions.ts` only to compose published override text around known-good base instructions; do not delete the base.
- `components/admin/AIControlCenter.tsx`

### Task 1: Add runtime-config and prompt-version schema

**Files:**
- Create: `supabase/migrations/202609190002_ai_control_plane.sql`

**Interfaces:**
- Produces `ai_runtime_config`, `ai_stage_config`, `ai_prompt_versions`.

- [ ] **Step 1: Write schema invariants**

```sql
-- Exactly one runtime config row (id = 1).
-- Exactly one stage row per supported stage.
-- At most one published prompt per prompt_type.
-- Draft and archived versions never become live through a read query.
```

- [ ] **Step 2: Create runtime configuration tables**

```sql
create table if not exists public.ai_runtime_config (
  id smallint primary key default 1 check (id = 1),
  auto_routing_enabled boolean not null default true,
  safe_mode boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_stage_config (
  stage text primary key check (stage in ('requirement','research','creative_director','final_prompt','repair')),
  mode text not null default 'auto' check (mode in ('auto','manual')),
  model_override text,
  fallback_model text,
  reasoning_effort text not null default 'low' check (reasoning_effort in ('none','low','medium','high')),
  max_output_tokens integer not null check (max_output_tokens between 128 and 10000),
  updated_at timestamptz not null default now()
);
```

- [ ] **Step 3: Create prompt versions with one-published constraint**

```sql
create table if not exists public.ai_prompt_versions (
  id uuid primary key default gen_random_uuid(),
  prompt_type text not null check (prompt_type in ('system','creative_director')),
  version integer not null,
  status text not null check (status in ('draft','published','archived')),
  content text not null,
  change_note text,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique(prompt_type, version)
);

create unique index if not exists ai_prompt_versions_one_published
on public.ai_prompt_versions(prompt_type)
where status = 'published';
```

- [ ] **Step 4: Seed rows from existing known-good defaults**

Seed stage rows matching current runtime behavior. Seed published prompt records only if the migration can safely populate exact existing prompt text; otherwise seed through a one-time server script in Task 3 and keep code fallback active until seeded.

- [ ] **Step 5: Apply migration in development and commit**

```bash
git add supabase/migrations/202609190002_ai_control_plane.sql
git commit -m "feat: add AI control plane schema"
```

### Task 2: Define known-good defaults and model allowlist

**Files:**
- Create: `lib/ai/safe-defaults.ts`
- Test: `tests/ai-model-router.test.ts`

**Interfaces:**
```ts
export const SAFE_STAGE_CONFIG: Record<AIStage, StageRuntimeConfig>;
export const ALLOWED_AI_MODELS: readonly string[];
export const SAFE_SYSTEM_PROMPT: string;
export const SAFE_CREATIVE_DIRECTOR_PROMPT: string;
```

- [ ] **Step 1: Write failing tests**

Assert every supported stage has a default model, fallback model, reasoning effort, and max tokens, and every default model is in the allowlist.

- [ ] **Step 2: Implement defaults from current production behavior**

Use current code as the source of truth:
- legacy and structured current models remain the initial safe model(s);
- preserve existing prompt functions as code-level fallback;
- do not invent new model identifiers.

- [ ] **Step 3: Run tests and commit**

```bash
npm test -- tests/ai-model-router.test.ts
git add lib/ai/safe-defaults.ts tests/ai-model-router.test.ts
git commit -m "feat: define safe AI runtime defaults"
```

### Task 3: Add cached runtime-config loader

**Files:**
- Create: `lib/ai/config.ts`
- Test: extend `tests/ai-model-router.test.ts`

**Interfaces:**
```ts
export type StageRuntimeConfig = {
  stage: AIStage;
  mode: 'auto' | 'manual';
  modelOverride: string | null;
  fallbackModel: string;
  reasoningEffort: 'none' | 'low' | 'medium' | 'high';
  maxOutputTokens: number;
};

export async function getAIRuntimeConfig(options?: { bypassCache?: boolean }): Promise<{
  safeMode: boolean;
  autoRoutingEnabled: boolean;
  stages: Record<AIStage, StageRuntimeConfig>;
}>;

export function invalidateAIRuntimeConfigCache(): void;
```

- [ ] **Step 1: Write tests for DB success, invalid DB values, and DB failure**

Expected behavior:
- valid DB values → normalized config;
- model not in allowlist → reject that override and use safe default;
- DB unavailable → full known-good fallback.

- [ ] **Step 2: Implement a short TTL cache**

Use a module-local cache with a TTL of 30–60 seconds. Admin writes call `invalidateAIRuntimeConfigCache()` immediately.

- [ ] **Step 3: Run tests and commit**

```bash
npm test -- tests/ai-model-router.test.ts
git add lib/ai/config.ts tests/ai-model-router.test.ts
git commit -m "feat: load cached AI runtime configuration"
```

### Task 4: Implement model resolver precedence

**Files:**
- Create: `lib/ai/model-router.ts`
- Test: `tests/ai-model-router.test.ts`

**Interfaces:**
```ts
export function resolveModelForStage(input: {
  stage: AIStage;
  runtime: AIRuntimeConfig;
  budgetPolicy?: { forceCostSaver: boolean; forcedModel?: string; forcedReasoning?: 'low' | 'medium' | 'high' };
}): {
  model: string;
  fallbackModel: string;
  reasoningEffort: 'none' | 'low' | 'medium' | 'high';
  maxOutputTokens: number;
  source: 'safe_mode' | 'budget_guard' | 'manual' | 'auto';
};
```

- [ ] **Step 1: Write precedence tests**

Required order:
1. Safe Mode
2. Budget Guard
3. Manual Override
4. Auto Routing
5. fallback model on eligible call failure

- [ ] **Step 2: Run RED**

```bash
npm test -- tests/ai-model-router.test.ts
```

- [ ] **Step 3: Implement pure resolver**

Keep network/database work outside this function so precedence is exhaustively unit-testable.

- [ ] **Step 4: Run tests and commit**

```bash
npm test -- tests/ai-model-router.test.ts
git add lib/ai/model-router.ts tests/ai-model-router.test.ts
git commit -m "feat: resolve AI models by stage"
```

### Task 5: Add prompt version repository and transactional publish/rollback

**Files:**
- Create: `lib/ai/prompts.ts`
- Test: `tests/ai-prompts.test.ts`

**Interfaces:**
```ts
export async function getPublishedPrompt(promptType: 'system' | 'creative_director'): Promise<PromptVersion | null>;
export async function getDraftPrompt(promptType: 'system' | 'creative_director'): Promise<PromptVersion | null>;
export async function savePromptDraft(input: { promptType: PromptType; content: string; changeNote?: string }): Promise<PromptVersion>;
export async function publishPrompt(input: { promptType: PromptType; draftId: string }): Promise<PromptVersion>;
export async function rollbackPrompt(input: { promptType: PromptType; version: number }): Promise<PromptVersion>;
```

- [ ] **Step 1: Write tests for draft isolation and one-published behavior**

Tests must prove a saved Draft does not change `getPublishedPrompt()`.

- [ ] **Step 2: Add a Supabase RPC or transaction-safe publish operation**

Preferred SQL function:
```sql
create or replace function public.publish_ai_prompt(p_prompt_type text, p_draft_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare v_id uuid;
begin
  update public.ai_prompt_versions
  set status='archived'
  where prompt_type=p_prompt_type and status='published';

  update public.ai_prompt_versions
  set status='published', published_at=now()
  where id=p_draft_id and prompt_type=p_prompt_type and status='draft'
  returning id into v_id;

  if v_id is null then
    raise exception 'PROMPT_DRAFT_NOT_FOUND';
  end if;

  return v_id;
end;
$$;
```
Lock/constraint behavior must prevent two simultaneous published rows.

- [ ] **Step 3: Implement repository methods and audit writes**

Every publish/rollback writes `admin_audit_logs` with old/new version IDs and version numbers.

- [ ] **Step 4: Run tests and commit**

```bash
npm test -- tests/ai-prompts.test.ts
git add lib/ai/prompts.ts tests/ai-prompts.test.ts supabase/migrations/202609190002_ai_control_plane.sql
git commit -m "feat: version and publish AI prompts safely"
```

### Task 6: Replace hardcoded model selection at call sites

**Files:**
- Modify: `lib/chat/research.ts`
- Modify: `app/api/chat/route.ts`
- Test: `tests/ai-model-router.test.ts` plus focused integration tests.

- [ ] **Step 1: Write a failing integration test proving manual override changes the called model**

Mock `getAIRuntimeConfig()` and provider call; assert chosen model comes from `resolveModelForStage()`.

- [ ] **Step 2: Update structured research/generation calls**

Resolve each stage before provider invocation. Keep the existing environment variable only as part of safe defaults if still needed for backward compatibility, not as the final source of truth.

- [ ] **Step 3: Update legacy chat/repair calls**

Use `requirement/final_prompt` mapping and `repair`.

- [ ] **Step 4: Implement eligible fallback retry**

Only retry errors classified as model/provider availability/rate-limit/timeout. Do not retry validation or user-input failures as model fallbacks.

Record retry as `retry_index=1` in usage events.

- [ ] **Step 5: Run all tests/typecheck/build**

```bash
npm test
npm run typecheck
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add lib/chat/research.ts app/api/chat/route.ts
git commit -m "feat: route AI calls through runtime model config"
```

### Task 7: Compose published prompt overrides with code fallback

**Files:**
- Modify: `lib/ui/chat-instructions.ts`
- Modify: `lib/chat/research.ts`
- Test: `tests/ai-prompts.test.ts`

**Interfaces:**
- Production instruction builder receives published override text server-side.
- If DB prompt is missing/invalid, use existing code instructions unchanged.

- [ ] **Step 1: Write tests for published override, draft exclusion, and fallback**

- [ ] **Step 2: Add a composition API**

Example:
```ts
export function buildChatInstructions(settings: CreationSettings, overrides?: {
  system?: string;
  creativeDirector?: string;
}): string
```

Do not let an override remove hard safety/integrity requirements that must always remain code-controlled; place editable creative behavior in clearly bounded sections.

- [ ] **Step 3: Run tests and commit**

```bash
npm test -- tests/ai-prompts.test.ts
git add lib/ui/chat-instructions.ts lib/chat/research.ts tests/ai-prompts.test.ts
git commit -m "feat: apply published prompt overrides safely"
```

### Task 8: Add Admin Models API

**Files:**
- Create: `app/api/admin/ai/models/route.ts`
- Test: `tests/admin-ai-models-route.test.ts`

**Interfaces:**
- GET returns normalized current config.
- PATCH accepts only allowlisted models, supported reasoning values, and bounded token limits.
- PATCH writes audit log and invalidates runtime cache.

- [ ] **Step 1: Write auth and invalid-payload tests**

- [ ] **Step 2: Implement Zod schemas with model allowlist**

Never accept arbitrary model names directly from browser input.

- [ ] **Step 3: Run tests/typecheck and commit**

```bash
npm test -- tests/admin-ai-models-route.test.ts
npm run typecheck
git add app/api/admin/ai/models/route.ts tests/admin-ai-models-route.test.ts
git commit -m "feat: add admin AI model controls"
```

### Task 9: Add Admin Prompt APIs and Test Playground

**Files:**
- Create all prompt routes listed in File Structure.
- Test: `tests/admin-ai-prompts-route.test.ts`

**Interfaces:**
- Test route accepts sample user request, prompt type/draft IDs, and creation settings.
- Test execution sets `execution_mode='draft_test'`.
- Publish/rollback require explicit boolean confirmation in body, e.g. `confirm:true`.

- [ ] **Step 1: Write route tests for auth, draft save, test, publish confirmation, rollback**

- [ ] **Step 2: Implement GET/draft routes**

- [ ] **Step 3: Implement test route without mutating live pointer**

- [ ] **Step 4: Implement publish and rollback routes with transaction-safe repository calls**

- [ ] **Step 5: Run tests/typecheck and commit**

```bash
npm test -- tests/admin-ai-prompts-route.test.ts
npm run typecheck
git add app/api/admin/ai/prompts tests/admin-ai-prompts-route.test.ts
git commit -m "feat: add admin prompt lifecycle APIs"
```

### Task 10: Build Models and Prompts Admin tabs

**Files:**
- Create: `components/admin/AIModelsTab.tsx`
- Create: `components/admin/AIPromptsTab.tsx`
- Create: `components/admin/PromptTestPlayground.tsx`
- Modify: `components/admin/AIControlCenter.tsx`
- Modify: admin stylesheet(s)

- [ ] **Step 1: Implement Models tab**

Each stage row exposes Auto/Manual, model, fallback, reasoning, max tokens, and Reset to Auto. Save requires a confirmation dialog because changes take effect immediately.

- [ ] **Step 2: Implement Prompts tab**

Clearly label Published and Draft versions. Include edit area, change note, Save Draft, Test, Compare, Publish, Rollback.

- [ ] **Step 3: Implement side-by-side Playground**

Render Published and Draft outputs with model/tokens/latency/cost metadata. Do not show raw hidden system instructions outside the authenticated admin UI.

- [ ] **Step 4: Verify on iPad widths**

No overlapping controls; editor and compare panels stack vertically on narrow widths.

- [ ] **Step 5: Full verification and commit**

```bash
npm test
npm run typecheck
npm run build
git add components/admin
git commit -m "feat: add admin AI model and prompt controls"
```

## Phase 2 Review Gate

Before Phase 3:
- verify a manual model override changes only its intended stage;
- verify Reset to Auto restores resolver behavior;
- verify a Draft never affects production;
- verify compare/test usage is tagged draft_test;
- verify publish and rollback are audited;
- verify DB failure uses code defaults;
- verify current user-facing prompt quality has no regression on the agreed regression cases.
