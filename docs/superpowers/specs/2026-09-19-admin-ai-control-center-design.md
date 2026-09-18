# Neramit Admin AI Control Center — Design Spec

Date: 2026-09-19  
Status: Approved design, pending implementation plan  
Repository: `maillys12/Neramittt`  
Target branch for design work: `design/admin-ai-control-center`

## 1. Purpose

Extend the existing Neramit admin dashboard into an AI Control Center that lets the single owner monitor AI spend and usage, control model routing, manage production prompts safely, define budget protections, and review system history without editing code for routine operations.

The current admin functions remain available. This design adds AI-specific controls without removing existing dashboard, device, reference-image, quota, or error-management capabilities.

## 2. Goals

The owner must be able to:

- See AI cost, credit usage, token usage, request volume, and current AI health.
- See OpenAI account/billing information when a reliable API source is available, while never presenting estimated values as provider-reported balances.
- Set and monitor a Neramit monthly AI budget.
- Use Auto Model Routing with manual per-stage overrides.
- Change model, reasoning effort, and max output token limits from Admin.
- Manage System Prompt and Creative Director Prompt with Draft → Test → Compare → Publish flow.
- Roll back prompts to earlier published versions.
- Define editable Budget Guard thresholds and actions.
- Receive alerts inside Admin only.
- Review an immutable-style audit history of significant AI-control changes.
- Activate Safe Mode that bypasses runtime overrides and returns to known-good code defaults.

## 3. Non-goals for this phase

- Multi-admin accounts or role-based permissions.
- External notifications through email, LINE, Telegram, or other services.
- Exposing provider API keys or secret values in the browser.
- Automatically guessing a provider credit balance when no reliable provider API exists.
- Removing existing code-level known-good fallback configuration.

## 4. Admin information architecture

The existing Admin area gains an AI Control Center with six tabs:

1. Overview
2. Usage & Cost
3. Models
4. Prompts
5. Budget Guard
6. History

The design should remain usable on iPad/mobile and preserve the visual language of the current Neramit admin UI.

## 5. Overview tab

The Overview tab is the owner’s operational summary.

Primary cards:

- AI cost today
- AI cost this month
- Neramit budget used
- Neramit budget remaining
- Credit used today
- Credit used this month
- Current request volume
- Input/output token totals
- Current AI operating mode
- Current published prompt version
- Current model-routing mode

Provider billing panel:

- Provider-reported usage/cost when available.
- Provider credit/balance only when a reliable API and required account permissions are available.
- If unavailable, explicitly show that provider balance is unavailable via API rather than substituting an estimate.

Notifications panel:

- Info
- Warning
- Critical

Examples include low budget, spending spike, repeated AI failures, Safe Mode activation, Budget Guard activation, prompt publication, and rollback.

## 6. Usage & Cost tab

Supported time ranges:

- Today
- 7 days
- 30 days
- Current month
- Current billing period
- All recorded usage
- Custom date range

Metric switcher:

- Cost
- Credit used
- Tokens
- Requests

Breakdowns:

- By model
- By stage
- By success/error status
- Production vs draft-test execution

Tracked stages should support at least:

- requirement
- research
- creative_director
- final_prompt
- repair

Each usage event should capture enough data to calculate and explain historical cost without retroactively changing old records when model pricing changes.

Required recorded fields include:

- request_id
- execution_mode
- stage
- model
- input_tokens
- output_tokens
- cached_tokens when available
- estimated_cost_usd
- estimated_cost_thb
- exchange_rate_snapshot
- pricing_version
- duration_ms
- status
- error classification when applicable
- created_at

The tab should also surface expensive requests and abnormal usage patterns.

## 7. Credit used

“Credit used” is displayed separately from generic “cost” so the owner can understand consumption directly.

The system should show at least:

- Credit used today
- Credit used this month
- Credit used in current billing period
- Credit used across all recorded usage
- Budget used as amount and percentage

If provider-reported credit usage is available, keep it visually separate from Neramit’s internally calculated usage and budget accounting.

Never merge provider-reported balance, estimated cost, and internal budget into a single ambiguous number.

## 8. Models tab

Default behavior is Auto Routing.

The system must support stage-aware model configuration. Each stage can be:

- Auto
- Manual Override

Each stage supports:

- active model or Auto
- fallback model
- reasoning effort where supported
- max output tokens
- reset to Auto

Changes to model/reasoning/token settings may become active immediately after owner confirmation.

Runtime selection order:

1. Safe Mode override, if active
2. Budget Guard enforced policy, if applicable
3. Manual stage override, if configured
4. Auto Routing selection
5. Fallback model after eligible runtime failure

A central server-side resolver such as `resolveModelForStage()` should own this logic. Production code should stop depending on hardcoded model values in individual request handlers.

## 9. Prompt management

Prompt control is intentionally safer than model configuration.

Prompt categories must include at least:

- Core/System Prompt
- Creative Director Prompt

Each category supports:

- Published version
- Draft version
- Archived versions
- Version metadata
- Change note
- Created/published timestamps

Production requests may use only a Published prompt.

Editing flow:

Draft → Save → Test → Compare → Publish

Publishing requires explicit confirmation.

Rollback creates or restores a known earlier published version and records the action in audit history.

A partially written Draft must never affect live users.

## 10. Test Playground

The Prompts tab includes a Test Playground.

The owner can enter a real sample request and run:

- Published configuration
- Draft configuration

The comparison should show:

- Result/output
- Model used
- Stage configuration
- Input/output tokens
- Latency
- Estimated cost
- Quality/format errors where available

Draft tests use `execution_mode = draft_test` and are excluded from production analytics by default, while remaining available through an explicit include-test filter.

## 11. Budget Guard

Budget Guard rules are owner-configurable.

A rule contains:

- enabled state
- metric/condition
- threshold
- operator
- action
- optional stage/model scope
- priority
- created/updated timestamps

Supported actions should include:

- Admin warning
- Admin critical alert
- Enable Cost Saver
- Reduce reasoning effort
- Force cheaper model routing
- Disable selected expensive stages
- Pause AI generation

Suggested default rules may be seeded, but the owner can modify, disable, or replace them.

Operational modes may include:

- Normal
- Warning
- Cost Saver
- Restricted
- Paused

The owner controls actual thresholds.

## 12. Internal Admin notifications

Notifications exist only inside Admin in this phase.

Required behavior:

- unread/read state
- severity: info, warning, critical
- timestamp
- event source
- concise message
- optional deep link to relevant AI Control Center tab

No external notification provider is required.

## 13. History and audit

Significant control-plane changes must be recorded in `admin_audit_log`.

Examples:

- model override changed
- Auto Routing toggled
- reasoning changed
- token limit changed
- prompt draft saved
- prompt published
- prompt rollback
- budget changed
- Budget Guard rule changed
- Budget Guard action triggered
- Safe Mode enabled/disabled

Each applicable audit entry should store previous and new values in a structured form so the owner can understand exactly what changed.

The regular Admin UI should not provide a casual delete control for audit history.

## 14. Safe Mode

Safe Mode is an emergency owner control.

When active:

- Ignore database model overrides.
- Ignore Draft prompts.
- Ignore manual routing overrides.
- Use known-good code-level model configuration.
- Use known-good code-level prompt defaults.
- Keep enough logging available to diagnose the incident.
- Show a prominent SAFE MODE ACTIVE banner in Admin.

Safe Mode must not depend solely on a potentially invalid runtime configuration object.

## 15. Proposed data model

### ai_runtime_config

Stores active control-plane values such as:

- auto_routing_enabled
- safe_mode
- stage configuration
- reasoning configuration
- token limits
- updated_at

The implementation may normalize stage settings into a dedicated table if that leads to clearer constraints and auditing.

### ai_prompt_versions

Suggested fields:

- id
- prompt_type
- version
- status: draft | published | archived
- content
- change_note
- created_at
- published_at

Enforce only one published version per prompt type.

### ai_usage_events

Stores each billable or measurable AI call.

Suggested fields:

- id
- request_id
- execution_mode
- stage
- model
- input_tokens
- output_tokens
- cached_tokens
- estimated_cost_usd
- estimated_cost_thb
- exchange_rate_snapshot
- pricing_version
- duration_ms
- status
- error_code
- created_at

### ai_budget_config

Suggested fields:

- monthly_budget_amount
- currency
- billing_period_anchor
- enabled
- updated_at

### ai_budget_rules

Suggested fields:

- id
- enabled
- priority
- condition_metric
- operator
- threshold
- action
- action_config
- updated_at

### admin_notifications

Suggested fields:

- id
- severity
- source
- title
- message
- read_at
- created_at
- metadata

### admin_audit_log

Suggested fields:

- id
- action
- subject_type
- subject_id
- previous_value
- new_value
- metadata
- created_at

## 16. Runtime flow

Primary request flow:

User Request
→ existing device/quota checks
→ load cached AI runtime configuration
→ evaluate Budget Guard
→ resolve stage
→ resolve model/reasoning/token policy
→ load Published prompt configuration
→ call provider
→ capture provider usage
→ calculate cost using versioned pricing
→ record `ai_usage_events`
→ continue application workflow
→ expose aggregated metrics to Admin

The runtime config may use a short server-side cache so normal requests do not query Supabase repeatedly. Configuration writes should invalidate or naturally expire that cache quickly.

## 17. Cost calculation

Cost records must be reproducible historically.

A pricing layer should identify:

- provider
- model
- input unit rate
- output unit rate
- cached-input rate where relevant
- effective date/version

Each usage event stores `pricing_version`.

THB conversion should use a recorded exchange-rate snapshot or explicit configured rate so historical THB numbers remain stable.

Provider billing totals and internally estimated cost must be labeled distinctly.

## 18. OpenAI/provider balance behavior

The UI should support provider account information but must remain truthful about availability.

If a supported API can reliably return billing/credit data with the account’s available permissions, display provider-reported data and timestamp it.

If not available:

- Show provider balance as unavailable via API.
- Continue showing internally tracked usage/cost.
- Continue showing Neramit budget used/remaining.
- Never fabricate or infer a provider balance and label it as real credit.

## 19. Error and fallback behavior

Failures should be classified rather than treated as one generic error.

Examples:

- model unavailable
- provider rate limit
- provider timeout
- malformed output
- quality gate failure
- prompt configuration invalid
- runtime configuration invalid
- usage logging failure
- database configuration failure

Eligible model failures may use a configured fallback model.

Prompt/config failures should fall back to known-good code defaults where safe.

Usage logging failure must not expose secrets and should create an Admin-visible error without silently corrupting budget state.

## 20. Admin API surface

Proposed endpoints:

- `GET /api/admin/ai/overview`
- `GET /api/admin/ai/usage`
- `GET/PATCH /api/admin/ai/models`
- `GET /api/admin/ai/prompts`
- `PATCH /api/admin/ai/prompts/draft`
- `POST /api/admin/ai/prompts/test`
- `POST /api/admin/ai/prompts/publish`
- `POST /api/admin/ai/prompts/rollback`
- `GET/PATCH /api/admin/ai/budget`
- `GET/POST/PATCH /api/admin/ai/budget-rules`
- `GET/PATCH /api/admin/ai/notifications`
- `GET /api/admin/ai/history`
- `POST /api/admin/ai/safe-mode`

The final implementation may consolidate endpoints where appropriate, but security and separation of read/write responsibilities must remain clear.

## 21. Security

The existing single-owner admin authentication model remains in this phase.

Requirements:

- All AI-control write endpoints require a valid server-verified admin session.
- Never return provider API secrets, service-role keys, prompt secrets, or environment secrets to the browser.
- Validate every writable enum, model identifier, numeric limit, and rule payload server-side.
- Use allowlists for supported model/config values.
- Prompt publishing and Safe Mode transitions require explicit confirmation in UI.
- Audit every production-impacting control change.
- User-facing APIs must not expose unpublished prompt contents or admin configuration internals.
- Database access must continue through trusted server-side paths for privileged AI configuration.

## 22. Performance

- Cache published AI runtime configuration briefly on the server.
- Do not query full history or full usage tables for every request.
- Build Admin metrics from bounded queries or aggregates.
- Add indexes around usage timestamps, model, stage, execution_mode, and request_id.
- Keep usage logging off the client critical path where safe, without losing essential accounting integrity.

## 23. Rollout plan

### Phase 1 — Observe

- Add usage-event storage.
- Track tokens, model, stage, latency, cost estimates.
- Build Overview and Usage & Cost.
- Do not change runtime model routing yet.

### Phase 2 — Control

- Add AI runtime config.
- Add Auto Routing and Manual Override.
- Add prompt versioning.
- Add Draft/Test/Compare/Publish/Rollback.
- Preserve code fallback.

### Phase 3 — Protect

- Add Budget Guard.
- Add notifications.
- Add Safe Mode controls.
- Add richer audit/history views.
- Enable cost-saving automated actions after usage tracking is proven reliable.

## 24. Testing strategy

Implementation should use tests for:

- model resolver precedence
- Safe Mode precedence
- fallback model behavior
- published-vs-draft prompt isolation
- only-one-published-version constraint
- prompt publish/rollback flow
- Budget Guard threshold evaluation
- Budget Guard action priority
- cost calculation and pricing-version persistence
- execution_mode filtering
- admin endpoint authorization
- invalid admin payload rejection
- usage aggregation
- provider-balance unavailable state
- audit-log creation for production-impacting changes

A production rollout should not depend on manual UI testing alone.

## 25. Acceptance criteria

The design is complete when an owner can, without changing code:

- Inspect AI usage, cost, tokens, requests, and credit used.
- Monitor internal budget used and remaining.
- See provider balance only when genuinely available.
- Change AI model behavior through Auto Routing or stage override.
- Edit prompts safely through a Draft/Test/Publish workflow.
- Compare a Draft prompt against Published behavior before release.
- Roll back prompts.
- Configure Budget Guard rules.
- See Admin-only alerts.
- Review control history.
- Activate Safe Mode and return the AI runtime to known-good defaults.

Existing Admin functionality must continue to work.

## 26. Design decisions approved by owner

- Owner-only admin model.
- Tab-based AI Control Center.
- Hybrid configuration: database-managed controls with code-level known-good fallback.
- Both provider account information and internal Neramit budget are shown, but kept distinct.
- Auto Model Routing with per-stage Manual Override.
- Model/reasoning/token settings can apply immediately.
- System and Creative Director prompts require Draft → Test → Publish.
- Budget Guard rules are fully owner-configurable.
- Notifications stay inside Admin.
- Credit-used metrics are shown separately from general cost.
