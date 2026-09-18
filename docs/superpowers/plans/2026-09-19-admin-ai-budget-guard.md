# Admin AI Budget Guard and Safe Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add owner-configurable budget protection, Admin-only notifications, operational history, and an emergency Safe Mode on top of the verified observability and control-plane phases.

**Architecture:** Evaluate pure Budget Guard rules against an internal budget snapshot before every AI call, convert the winning policy into runtime constraints, and log every automated transition. Safe Mode has higher precedence than Budget Guard and model overrides and always falls back to code-level known-good configuration.

**Tech Stack:** Next.js 15, React 19, TypeScript 5.9, Supabase/Postgres, Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-19-admin-ai-control-center-design.md`

## Global Constraints

- Phase 1 and Phase 2 must be complete and verified first.
- Owner defines Budget Guard thresholds/actions.
- Notifications remain inside Admin only.
- Safe Mode has highest runtime precedence.
- No external messaging integration is included.
- Automated controls must be auditable and reversible.
- Do not deploy until explicitly approved.

---

## File Structure

Create:
- `supabase/migrations/202609190003_ai_budget_guard.sql`
- `lib/ai/budget-guard.ts`
- `lib/ai/notifications.ts`
- `lib/admin/audit.ts`
- `app/api/admin/ai/budget/route.ts`
- `app/api/admin/ai/budget-rules/route.ts`
- `app/api/admin/ai/notifications/route.ts`
- `app/api/admin/ai/history/route.ts`
- `app/api/admin/ai/safe-mode/route.ts`
- `components/admin/AIBudgetGuardTab.tsx`
- `components/admin/AIHistoryTab.tsx`
- `components/admin/AdminNotificationCenter.tsx`
- `tests/ai-budget-guard.test.ts`
- `tests/admin-ai-budget-route.test.ts`
- `tests/admin-ai-safe-mode.test.ts`
- `tests/admin-ai-history.test.ts`

Modify:
- `lib/ai/model-router.ts`
- `lib/ai/config.ts`
- AI provider call wrappers from Phase 2
- `components/admin/AIControlCenter.tsx`

### Task 1: Add Budget Guard schema

**Files:**
- Create: `supabase/migrations/202609190003_ai_budget_guard.sql`

**Interfaces:**
- Produces `ai_budget_rules`.
- May extend `ai_runtime_config` with current operational mode if useful, but the source of truth should be deterministic rule evaluation plus Safe Mode.

- [ ] **Step 1: Create rule table**

```sql
create table if not exists public.ai_budget_rules (
  id uuid primary key default gen_random_uuid(),
  enabled boolean not null default true,
  priority integer not null default 100,
  condition_metric text not null check (condition_metric in ('budget_used_percent','budget_remaining_thb','daily_cost_thb','monthly_cost_thb')),
  operator text not null check (operator in ('gte','lte','gt','lt')),
  threshold numeric(18,6) not null,
  action text not null check (action in ('notify_warning','notify_critical','cost_saver','reduce_reasoning','force_model','disable_stage','pause_ai')),
  action_config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists ai_budget_rules_priority_idx
on public.ai_budget_rules(enabled, priority asc);
```

- [ ] **Step 2: Seed suggested defaults as disabled or clearly editable rules**

Do not silently activate aggressive shutdown rules during migration. Seed recommendations disabled unless the owner explicitly enables them.

- [ ] **Step 3: Apply migration in development and commit**

```bash
git add supabase/migrations/202609190003_ai_budget_guard.sql
git commit -m "feat: add AI budget guard schema"
```

### Task 2: Implement pure rule evaluation

**Files:**
- Create: `lib/ai/budget-guard.ts`
- Test: `tests/ai-budget-guard.test.ts`

**Interfaces:**
```ts
export type BudgetGuardAction =
  | { type: 'notify_warning' }
  | { type: 'notify_critical' }
  | { type: 'cost_saver' }
  | { type: 'reduce_reasoning'; effort: 'low' | 'medium' }
  | { type: 'force_model'; model: string }
  | { type: 'disable_stage'; stage: AIStage }
  | { type: 'pause_ai' };

export function evaluateBudgetGuard(input: {
  snapshot: BudgetSnapshot & { dailyCostThb: number; monthlyCostThb: number };
  rules: BudgetRule[];
  stage: AIStage;
}): {
  mode: 'normal' | 'warning' | 'cost_saver' | 'restricted' | 'paused';
  actions: BudgetGuardAction[];
};
```

- [ ] **Step 1: Write tests for each operator/action and rule priority**

Include overlapping rules and assert deterministic ordering.

- [ ] **Step 2: Write a test proving disabled rules have no effect**

- [ ] **Step 3: Write allowlist tests for force_model/action_config**

Unknown models/stages must be rejected during normalization.

- [ ] **Step 4: Implement pure evaluator**

No DB/network calls inside `evaluateBudgetGuard()`.

- [ ] **Step 5: Run tests and commit**

```bash
npm test -- tests/ai-budget-guard.test.ts
git add lib/ai/budget-guard.ts tests/ai-budget-guard.test.ts
git commit -m "feat: evaluate owner-defined AI budget rules"
```

### Task 3: Integrate Budget Guard before model resolution

**Files:**
- Modify: `lib/ai/model-router.ts`
- Modify provider-call orchestration files
- Test: `tests/ai-model-router.test.ts`, `tests/ai-budget-guard.test.ts`

- [ ] **Step 1: Write precedence test**

Prove:
`safe_mode > budget_guard > manual > auto`.

- [ ] **Step 2: Translate actions into routing policy**

Examples:
- cost_saver → safe cheap route for stage;
- reduce_reasoning → lower effort only;
- force_model → force allowlisted model;
- disable_stage → return structured stage-disabled result;
- pause_ai → return structured AI_PAUSED before provider call.

- [ ] **Step 3: Preserve user-facing error semantics**

Convert internal policy blocks into a controlled maintenance/limited-service response, not raw internal rule names.

- [ ] **Step 4: Run tests/typecheck and commit**

```bash
npm test -- tests/ai-model-router.test.ts tests/ai-budget-guard.test.ts
npm run typecheck
git add lib/ai/model-router.ts lib/chat app/api/chat
git commit -m "feat: enforce AI budget guard at runtime"
```

### Task 4: Centralize Admin audit writes

**Files:**
- Create: `lib/admin/audit.ts`
- Test: `tests/admin-ai-history.test.ts`
- Modify existing Admin write routes progressively to call the helper.

**Interfaces:**
```ts
export async function writeAdminAudit(input: {
  action: string;
  subjectType?: string;
  subjectId?: string;
  previousValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown>;
}): Promise<void>;
```

- [ ] **Step 1: Write tests proving structured before/after values are persisted**

- [ ] **Step 2: Implement sanitized audit helper**

Do not allow API keys, raw credentials, or secret environment values into audit metadata.

- [ ] **Step 3: Replace AI-control direct audit inserts with helper**

- [ ] **Step 4: Run tests and commit**

```bash
npm test -- tests/admin-ai-history.test.ts
git add lib/admin/audit.ts app/api/admin/ai
git commit -m "refactor: centralize admin AI audit logging"
```

### Task 5: Add Admin-only notification service

**Files:**
- Create: `lib/ai/notifications.ts`
- Test: extend `tests/admin-ai-history.test.ts`

**Interfaces:**
```ts
export async function createAdminNotification(input: {
  severity: 'info' | 'warning' | 'critical';
  source: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  dedupeKey?: string;
}): Promise<void>;
```

- [ ] **Step 1: Write deduplication test**

Repeated identical budget warnings in a short window should not create notification spam.

- [ ] **Step 2: Implement notification creation and dedupe**

Use metadata/dedupe key plus a bounded recent-time query.

- [ ] **Step 3: Hook notifications to Budget Guard transitions and repeated provider failures**

- [ ] **Step 4: Run tests and commit**

```bash
npm test -- tests/admin-ai-history.test.ts
git add lib/ai/notifications.ts
git commit -m "feat: add admin AI notifications"
```

### Task 6: Add Budget, rules, notifications, and history APIs

**Files:**
- Create routes listed in File Structure.
- Tests: `tests/admin-ai-budget-route.test.ts`, `tests/admin-ai-history.test.ts`

**Interfaces:**
- Budget PATCH validates amount, currency=THB, anchor 1–28.
- Rule writes validate action-specific `action_config`.
- Notifications PATCH only marks read/unread; it cannot rewrite event contents.
- History GET is paginated and newest-first.

- [ ] **Step 1: Write authorization and payload-validation tests**

- [ ] **Step 2: Implement budget route**

- [ ] **Step 3: Implement rule CRUD route**

Use POST create, PATCH update/toggle; no bulk arbitrary JSON update.

- [ ] **Step 4: Implement notifications and history routes**

Cap page sizes to a safe maximum.

- [ ] **Step 5: Run tests/typecheck and commit**

```bash
npm test -- tests/admin-ai-budget-route.test.ts tests/admin-ai-history.test.ts
npm run typecheck
git add app/api/admin/ai
git commit -m "feat: expose AI budget guard admin APIs"
```

### Task 7: Implement Safe Mode endpoint and precedence

**Files:**
- Create: `app/api/admin/ai/safe-mode/route.ts`
- Modify: `lib/ai/config.ts`
- Modify: `lib/ai/model-router.ts`
- Test: `tests/admin-ai-safe-mode.test.ts`

**Interfaces:**
- POST body:
```ts
{ enabled: boolean; confirm: true }
```
- Enabling/disabling always writes audit and notification events.
- Runtime cache invalidates immediately.

- [ ] **Step 1: Write tests proving confirm is mandatory**

- [ ] **Step 2: Write tests proving Safe Mode ignores DB overrides**

- [ ] **Step 3: Implement endpoint**

Require `requireAdmin(req)`, update singleton runtime config, invalidate cache, write audit, create notification.

- [ ] **Step 4: Run tests/typecheck and commit**

```bash
npm test -- tests/admin-ai-safe-mode.test.ts tests/ai-model-router.test.ts
npm run typecheck
git add app/api/admin/ai/safe-mode/route.ts lib/ai
git commit -m "feat: add emergency AI safe mode"
```

### Task 8: Build Budget Guard, History, and Notification UI

**Files:**
- Create: `components/admin/AIBudgetGuardTab.tsx`
- Create: `components/admin/AIHistoryTab.tsx`
- Create: `components/admin/AdminNotificationCenter.tsx`
- Modify: `components/admin/AIControlCenter.tsx`
- Modify: admin stylesheet(s)

- [ ] **Step 1: Build budget editor**

Show monthly budget, used, remaining, billing anchor, and enabled state.

- [ ] **Step 2: Build rule editor**

Each row exposes enabled, condition, operator, threshold, action, and action-specific options. Use constrained selects, not arbitrary JSON text areas.

- [ ] **Step 3: Build notification center**

Badge unread count; severity; mark read; deep link to relevant tab.

- [ ] **Step 4: Build History tab**

Paginated timeline showing action, timestamp, before/after summary, and affected subject.

- [ ] **Step 5: Add persistent Safe Mode banner/button**

When active, show a high-visibility banner across AI Control Center. Enabling/disabling requires confirmation.

- [ ] **Step 6: Responsive verification**

Check phone and iPad layouts; rule rows may stack but must remain understandable and editable.

- [ ] **Step 7: Full verification and commit**

```bash
npm test
npm run typecheck
npm run build
git add components/admin
git commit -m "feat: add AI budget guard and history admin UI"
```

## Final Review Gate

Before considering the feature implementation complete:
- verify every spec acceptance criterion maps to working UI/API behavior;
- verify Safe Mode overrides all DB routing/prompt settings;
- verify Budget Guard actions are deterministic and audited;
- verify provider balance unavailable state remains truthful;
- verify no secret appears in browser responses, audit rows, notifications, or usage metadata;
- verify existing Admin actions still work;
- run `npm test`, `npm run typecheck`, and `npm run build`;
- perform manual iPad/mobile verification;
- do not merge or deploy without explicit owner approval.
