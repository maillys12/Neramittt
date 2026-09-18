# Admin AI Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add trustworthy AI usage, token, cost, credit-used, and budget observability to the existing Neramit Admin without changing production model-routing behavior.

**Architecture:** Introduce a server-side AI usage ledger and pricing layer around every OpenAI call, then aggregate it through new admin-only APIs and a new tabbed AI Control Center UI. Phase 1 is deliberately read-mostly: it records and displays data but does not yet change how production chooses models or prompts.

**Tech Stack:** Next.js 15, React 19, TypeScript 5.9, Supabase/Postgres, OpenAI Node SDK 5.x, Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-19-admin-ai-control-center-design.md`

## Global Constraints

- Keep the existing single-owner admin authentication model.
- Do not expose provider secrets, service-role keys, prompt secrets, or environment secrets to browser code.
- Provider-reported billing data and internally estimated cost must be labeled separately.
- Never fabricate a provider credit balance when the provider/API does not return one reliably.
- Existing Admin functionality must continue to work.
- Do not change production model-routing behavior in this phase.
- All production-impacting work must remain on a feature branch until explicitly approved for merge/deploy.

---

## File Structure

Create:
- `supabase/migrations/202609190001_ai_observability.sql` — usage ledger, pricing metadata, budget config, notification/audit extensions and indexes.
- `lib/ai/types.ts` — shared server-side AI stage/execution/usage types.
- `lib/ai/pricing.ts` — versioned model pricing and deterministic cost calculation.
- `lib/ai/usage.ts` — usage extraction/persistence helper.
- `lib/ai/budget.ts` — internal budget calculations only; no enforcement yet.
- `lib/ai/provider-billing.ts` — provider billing adapter with explicit unavailable state.
- `app/api/admin/ai/overview/route.ts` — Admin overview metrics.
- `app/api/admin/ai/usage/route.ts` — time-range usage aggregates and request detail.
- `components/admin/AIControlCenter.tsx` — tab shell and Phase 1 overview/usage views.
- `components/admin/AIOverviewTab.tsx`
- `components/admin/AIUsageTab.tsx`
- `tests/ai-pricing.test.ts`
- `tests/ai-budget.test.ts`
- `tests/ai-usage.test.ts`
- `tests/admin-ai-usage-route.test.ts`

Modify:
- `lib/chat/research.ts` — wrap research and generation calls with usage capture.
- `app/api/chat/route.ts` — wrap legacy OpenAI calls with usage capture.
- `components/AdminClient.tsx` — mount AI Control Center while preserving existing cards/actions.
- Admin CSS file(s) already used by current admin UI — add tab/metric/graph styling without rewriting the app-wide visual system.

### Task 1: Add AI observability schema

**Files:**
- Create: `supabase/migrations/202609190001_ai_observability.sql`

**Interfaces:**
- Produces Postgres tables `ai_usage_events`, `ai_budget_config`, `admin_notifications`; adds indexes used by later API tasks.
- Existing `admin_audit_logs` remains the canonical audit table; do not create a duplicate audit table unless the existing schema cannot support structured metadata.

- [ ] **Step 1: Write migration assertions as SQL comments/checklist before DDL**

Document the invariants at the top of the migration:
```sql
-- Invariants:
-- 1) ai_usage_events is append-only from application code.
-- 2) request_id + stage may repeat only when retry_index differs.
-- 3) estimated cost is stored with pricing_version and exchange-rate snapshot.
-- 4) draft_test and production executions are distinguishable.
-- 5) budget config has exactly one active owner-wide row.
```

- [ ] **Step 2: Add the usage ledger**

Use explicit columns and checks:
```sql
create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  request_id text not null,
  execution_mode text not null check (execution_mode in ('production','draft_test')),
  stage text not null check (stage in ('requirement','research','creative_director','final_prompt','repair')),
  model text not null,
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  cached_tokens bigint not null default 0 check (cached_tokens >= 0),
  estimated_cost_usd numeric(18,8) not null default 0 check (estimated_cost_usd >= 0),
  estimated_cost_thb numeric(18,6) not null default 0 check (estimated_cost_thb >= 0),
  exchange_rate_snapshot numeric(18,6) not null default 0 check (exchange_rate_snapshot >= 0),
  pricing_version text not null,
  duration_ms integer not null default 0 check (duration_ms >= 0),
  status text not null check (status in ('success','error')),
  error_code text,
  retry_index integer not null default 0 check (retry_index >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_events_created_at_idx on public.ai_usage_events(created_at desc);
create index if not exists ai_usage_events_stage_created_idx on public.ai_usage_events(stage, created_at desc);
create index if not exists ai_usage_events_model_created_idx on public.ai_usage_events(model, created_at desc);
create index if not exists ai_usage_events_request_idx on public.ai_usage_events(request_id);
create index if not exists ai_usage_events_mode_created_idx on public.ai_usage_events(execution_mode, created_at desc);
```

- [ ] **Step 3: Add owner-wide budget and notifications tables**

```sql
create table if not exists public.ai_budget_config (
  id smallint primary key default 1 check (id = 1),
  monthly_budget_amount numeric(18,2) not null default 1000 check (monthly_budget_amount >= 0),
  currency text not null default 'THB' check (currency = 'THB'),
  billing_period_anchor smallint not null default 1 check (billing_period_anchor between 1 and 28),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.ai_budget_config(id)
values (1)
on conflict (id) do nothing;

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  severity text not null check (severity in ('info','warning','critical')),
  source text not null,
  title text not null,
  message text not null,
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_notifications_unread_idx
  on public.admin_notifications(created_at desc)
  where read_at is null;
```

- [ ] **Step 4: Apply migration to a non-production database and inspect schema**

Run the project’s normal Supabase migration workflow against a development/staging database. Verify:
```sql
select column_name, data_type
from information_schema.columns
where table_name in ('ai_usage_events','ai_budget_config','admin_notifications')
order by table_name, ordinal_position;
```
Expected: all columns above exist and constraints are accepted.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/202609190001_ai_observability.sql
git commit -m "feat: add AI observability schema"
```

### Task 2: Add deterministic pricing and credit-used calculation

**Files:**
- Create: `lib/ai/types.ts`
- Create: `lib/ai/pricing.ts`
- Test: `tests/ai-pricing.test.ts`

**Interfaces:**
- Produces:
```ts
export type AIStage = 'requirement' | 'research' | 'creative_director' | 'final_prompt' | 'repair';
export type AIExecutionMode = 'production' | 'draft_test';

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
};

export function calculateEstimatedCost(input: {
  model: string;
  usage: TokenUsage;
  usdToThb: number;
}): {
  usd: number;
  thb: number;
  pricingVersion: string;
};
```

- [ ] **Step 1: Write failing pricing tests**

```ts
import { describe, expect, it } from 'vitest';
import { calculateEstimatedCost } from '@/lib/ai/pricing';

describe('calculateEstimatedCost', () => {
  it('uses the configured model price and exchange-rate snapshot', () => {
    const result = calculateEstimatedCost({
      model: 'gpt-5.6-luna',
      usage: { inputTokens: 1_000_000, outputTokens: 1_000_000, cachedTokens: 0 },
      usdToThb: 34,
    });

    expect(result.usd).toBeGreaterThan(0);
    expect(result.thb).toBeCloseTo(result.usd * 34, 6);
    expect(result.pricingVersion).toMatch(/^openai-/);
  });

  it('rejects an unknown model instead of silently guessing a price', () => {
    expect(() => calculateEstimatedCost({
      model: 'unknown-model',
      usage: { inputTokens: 10, outputTokens: 10, cachedTokens: 0 },
      usdToThb: 34,
    })).toThrow('AI_PRICE_UNKNOWN');
  });
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run:
```bash
npm test -- tests/ai-pricing.test.ts
```
Expected: FAIL because `@/lib/ai/pricing` does not exist.

- [ ] **Step 3: Implement a versioned allowlist pricing table**

Use a data shape that makes historical pricing explicit:
```ts
type PriceRow = {
  version: string;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
  cachedInputUsdPerMillion?: number;
};

const MODEL_PRICES: Record<string, PriceRow> = loadVerifiedPriceTable();
```

Before implementing `loadVerifiedPriceTable()`, verify the current price for every production model from an official OpenAI pricing/model source and encode those exact verified numbers in a checked-in constant table. If cached-input pricing is not published for a model, omit that field and let the calculator fall back to the normal input rate. The implementation step is not complete until the source and effective date used for the checked-in rates are recorded next to the table. Do not copy remembered pricing into code.

Calculation rule:
```ts
const uncachedInput = Math.max(0, usage.inputTokens - usage.cachedTokens);
const inputCost = uncachedInput / 1_000_000 * row.inputUsdPerMillion;
const cachedCost = usage.cachedTokens / 1_000_000 * (row.cachedInputUsdPerMillion ?? row.inputUsdPerMillion);
const outputCost = usage.outputTokens / 1_000_000 * row.outputUsdPerMillion;
```

- [ ] **Step 4: Run pricing tests**

```bash
npm test -- tests/ai-pricing.test.ts
npm run typecheck
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/types.ts lib/ai/pricing.ts tests/ai-pricing.test.ts
git commit -m "feat: add versioned AI cost calculation"
```

### Task 3: Capture provider usage consistently

**Files:**
- Create: `lib/ai/usage.ts`
- Test: `tests/ai-usage.test.ts`

**Interfaces:**
- Produces:
```ts
export function extractOpenAIUsage(response: unknown): TokenUsage;
export async function recordAIUsage(input: {
  requestId: string;
  executionMode: AIExecutionMode;
  stage: AIStage;
  model: string;
  startedAtMs: number;
  response?: unknown;
  status: 'success' | 'error';
  errorCode?: string;
  retryIndex?: number;
}): Promise<void>;
```

- [ ] **Step 1: Write failing usage extraction tests**

Cover responses with complete usage, absent usage, cached input tokens, and malformed values. Expected absent usage is zeros, not thrown errors.

- [ ] **Step 2: Run tests and confirm RED**

```bash
npm test -- tests/ai-usage.test.ts
```

- [ ] **Step 3: Implement extraction and persistence**

`recordAIUsage()` must:
1. extract token usage;
2. obtain a server-side USD→THB snapshot from a single configured source/function;
3. call `calculateEstimatedCost()`;
4. insert one `ai_usage_events` row through `getServerSupabase()`;
5. never include prompts, user text, API keys, or raw provider responses in `metadata`.

If usage persistence fails, log a sanitized `error_logs` record and rethrow `AI_USAGE_LOG_FAILED` only where accounting integrity is required. For optional observability paths, return a structured failure to the caller rather than leaking the DB error.

- [ ] **Step 4: Run tests and typecheck**

```bash
npm test -- tests/ai-usage.test.ts tests/ai-pricing.test.ts
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add lib/ai/usage.ts tests/ai-usage.test.ts
git commit -m "feat: record AI token usage and cost"
```

### Task 4: Instrument all current OpenAI calls

**Files:**
- Modify: `lib/chat/research.ts`
- Modify: `app/api/chat/route.ts`
- Test: extend `tests/ai-usage.test.ts` or add focused route/orchestrator tests using mocked OpenAI responses.

**Interfaces:**
- Consumes `recordAIUsage()`.
- Production stage mapping:
  - legacy chat primary generation → `requirement` or `final_prompt` based on existing final detection
  - legacy repair → `repair`
  - research web-search call → `research`
  - structured generation/creative director call → `creative_director` initially, until Phase 2 explicitly splits the generation stage further

- [ ] **Step 1: Write a failing test proving two OpenAI calls create two usage events**

Mock the provider and persistence helper; assert stage/model/status are captured separately.

- [ ] **Step 2: Run focused test and confirm RED**

```bash
npm test -- tests/ai-usage.test.ts
```

- [ ] **Step 3: Instrument `lib/chat/research.ts`**

Generate or receive a request ID at orchestration boundary and pass it to both provider calls. Measure each call independently with `Date.now()`.

Do not alter the current model selection yet:
```ts
const model = process.env.NERAMIT_RESEARCH_MODEL || 'gpt-5.6-luna';
```

- [ ] **Step 4: Instrument legacy `app/api/chat/route.ts` calls**

Wrap both the initial `responses.create` and repair request. Preserve existing response behavior and error handling.

- [ ] **Step 5: Run tests**

```bash
npm test
npm run typecheck
```
Expected: existing tests plus new usage tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/chat/research.ts app/api/chat/route.ts tests/ai-usage.test.ts
git commit -m "feat: instrument AI calls for usage tracking"
```

### Task 5: Add internal budget calculations

**Files:**
- Create: `lib/ai/budget.ts`
- Test: `tests/ai-budget.test.ts`

**Interfaces:**
- Produces:
```ts
export function billingWindow(anchorDay: number, now: Date): { start: Date; end: Date };
export async function getBudgetSnapshot(now?: Date): Promise<{
  enabled: boolean;
  monthlyBudgetThb: number;
  usedThb: number;
  remainingThb: number;
  usedPercent: number;
  periodStart: string;
  periodEnd: string;
}>;
```

- [ ] **Step 1: Write failing boundary tests**

Include month rollover and anchors near February; anchor is restricted to 1–28.

- [ ] **Step 2: Run and confirm RED**

```bash
npm test -- tests/ai-budget.test.ts
```

- [ ] **Step 3: Implement deterministic windowing and aggregation**

Use `estimated_cost_thb` from `ai_usage_events` where `execution_mode='production'` for internal budget usage. Do not mix draft-test usage by default.

- [ ] **Step 4: Run tests and commit**

```bash
npm test -- tests/ai-budget.test.ts
git add lib/ai/budget.ts tests/ai-budget.test.ts
git commit -m "feat: calculate Neramit AI budget usage"
```

### Task 6: Add provider billing adapter with truthful unavailable state

**Files:**
- Create: `lib/ai/provider-billing.ts`
- Test: extend `tests/ai-budget.test.ts`

**Interfaces:**
```ts
export type ProviderBillingSnapshot =
  | { available: true; source: 'openai'; asOf: string; costUsd?: number; creditBalanceUsd?: number }
  | { available: false; source: 'openai'; asOf: string; reason: 'unsupported' | 'unauthorized' | 'unconfigured' | 'error' };

export async function getProviderBillingSnapshot(): Promise<ProviderBillingSnapshot>;
```

- [ ] **Step 1: Write tests that require explicit unavailable states**

No fallback may derive a fake provider balance from internal budget values.

- [ ] **Step 2: Implement adapter behind server-only code**

If the installed OpenAI SDK/account permissions do not expose a reliable billing/credit endpoint, return `available:false` with the correct reason. Do not scrape dashboard HTML and do not expose admin keys to client code.

- [ ] **Step 3: Run tests and commit**

```bash
npm test -- tests/ai-budget.test.ts
git add lib/ai/provider-billing.ts tests/ai-budget.test.ts
git commit -m "feat: add provider billing availability adapter"
```

### Task 7: Build Admin AI overview and usage APIs

**Files:**
- Create: `app/api/admin/ai/overview/route.ts`
- Create: `app/api/admin/ai/usage/route.ts`
- Test: `tests/admin-ai-usage-route.test.ts`

**Interfaces:**
- Both routes call `requireAdmin(req)`.
- Overview returns:
```ts
{
  ok: true,
  budget: BudgetSnapshot,
  providerBilling: ProviderBillingSnapshot,
  today: { costThb: number; creditUsedThb: number; requests: number; inputTokens: number; outputTokens: number },
  month: { costThb: number; creditUsedThb: number; requests: number; inputTokens: number; outputTokens: number },
  unreadNotifications: number
}
```
- Usage accepts validated query params: `range`, `from`, `to`, `metric`, `includeTests`.

- [ ] **Step 1: Write authorization and validation tests**

Assert no admin token → 401; invalid range/date → 400; test usage excluded by default.

- [ ] **Step 2: Run and confirm RED**

```bash
npm test -- tests/admin-ai-usage-route.test.ts
```

- [ ] **Step 3: Implement bounded aggregate queries**

Never load the entire ledger to aggregate in JavaScript. Query only the requested window and cap detailed request lists.

- [ ] **Step 4: Run tests/typecheck and commit**

```bash
npm test -- tests/admin-ai-usage-route.test.ts
npm run typecheck
git add app/api/admin/ai/overview/route.ts app/api/admin/ai/usage/route.ts tests/admin-ai-usage-route.test.ts
git commit -m "feat: expose admin AI usage metrics"
```

### Task 8: Add Phase 1 AI Control Center UI

**Files:**
- Create: `components/admin/AIControlCenter.tsx`
- Create: `components/admin/AIOverviewTab.tsx`
- Create: `components/admin/AIUsageTab.tsx`
- Modify: `components/AdminClient.tsx`
- Modify: existing admin stylesheet(s)

**Interfaces:**
- `AIControlCenter` receives the existing admin token and owns tab state.
- Phase 1 tabs enabled: Overview, Usage & Cost.
- Models, Prompts, Budget Guard, History render clearly disabled “coming in next phase” states rather than fake controls.

- [ ] **Step 1: Add a component test or pure view-model test for tab state and labels**

If the project has no DOM test harness, extract a pure `AI_CONTROL_TABS` config and test exact labels/order in Vitest.

- [ ] **Step 2: Implement tab shell without removing existing Admin sections**

Mount the new control center below the existing admin summary or behind a top-level section switch; preserve device/settings/reference/error actions.

- [ ] **Step 3: Implement overview cards**

Show provider billing unavailable state explicitly, e.g. “OpenAI credit balance: API unavailable” rather than `0`.

- [ ] **Step 4: Implement usage controls and simple charts**

Use CSS/HTML already available in the app; do not add a chart dependency in Phase 1. Render accessible bars/lines from API aggregates.

- [ ] **Step 5: Verify responsive behavior manually**

Check iPad portrait/landscape and phone width. Ensure tabs horizontally scroll rather than overlap.

- [ ] **Step 6: Run full verification**

```bash
npm test
npm run typecheck
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add components/admin components/AdminClient.tsx app
git commit -m "feat: add AI usage and cost admin views"
```

## Phase 1 Review Gate

Before Phase 2, verify with real non-production usage that:
- every provider call creates a usage event;
- recorded token values match provider response metadata;
- internal cost estimates are reproducible;
- draft-test data can be excluded;
- provider balance is never fabricated;
- the current production model behavior remains unchanged.
