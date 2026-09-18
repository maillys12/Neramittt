# Neramit Research-Driven Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain-text chat response with a researched, bilingual, structured experience that supports Smart Reply Cards, verified institutional guidance, prompt/copy recommendations, and truthful streamed work statuses.

**Architecture:** Keep the existing Next.js `/api/chat` boundary and OpenAI Responses SDK, but introduce shared Zod contracts, a research-aware orchestration module, and an NDJSON stream. The client incrementally consumes stage events and renders structured turns while retaining legacy text-message compatibility. Supabase receives one backward-compatible `metadata jsonb` column and all rollout is gated by `NERAMIT_RESEARCH_CHAT_V2`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5.9, OpenAI Node SDK 5.20, Zod 3.25, Supabase PostgreSQL, Vitest, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-17-neramit-research-smart-replies-design.md`

## Global Constraints

- Do not implement or expose the four Neramit AI tiers in this change.
- Preserve the existing Neramit palette, rounded visual language, mascot, and SVG icon system.
- Functional emoji icons are forbidden.
- Preserve `neramit_device_token_v1` and device-scoped draft ownership checks.
- Thai mode returns advanced Thai conversation, cards, copy, recommendations, and final prompts; English mode returns English equivalents.
- Every final prompt-generation job executes web research; official named entities prefer primary/official sources.
- Never fabricate logos, seals, dates, contacts, job terms, or other official facts.
- Without an authentic supplied logo, reserve logo space and request the asset instead of asking an image model to recreate it.
- Work statuses must come from actual server events; never cycle fake stages or percentages.
- Request payloads and model output must be validated with Zod.
- Existing plain-text chat rows and drafts must remain renderable.
- No secrets, raw source-page bodies, or hidden reasoning may be persisted.
- Before merge run `npm test`, `npm run typecheck`, and `npm run build`.
- Deploy database migration before enabling `NERAMIT_RESEARCH_CHAT_V2` in Production.

---

### Task 1: Shared structured chat contracts and localization

**Files:**
- Create: `lib/chat/contracts.ts`
- Create: `lib/chat/status.ts`
- Test: `tests/chat-contracts.test.ts`

**Interfaces:**
- Produces: `AssistantTurnSchema`, `ChatStreamEventSchema`, `ChatRequestSchema`, `AssistantTurn`, `ChatStreamEvent`, `WorkStage`, `workStageLabel(stage, language)`.
- Consumes: `PromptLanguage` and creation-setting enums from `lib/ui/creation-settings.ts`.

- [ ] **Step 1: Write failing schema and localization tests**

```ts
expect(ChatStreamEventSchema.parse({ type: 'stage', stage: 'researching' })).toEqual({ type: 'stage', stage: 'researching' });
expect(() => ChatStreamEventSchema.parse({ type: 'stage', stage: 'pretending' })).toThrow();
expect(workStageLabel('identity_check', 'th')).toBe('กำลังตรวจสอบอัตลักษณ์และแหล่งข้อมูลทางการ');
expect(workStageLabel('identity_check', 'en')).toBe('Checking official identity and sources');
expect(AssistantTurnSchema.parse(questionTurn).interaction?.options).toHaveLength(3);
```

- [ ] **Step 2: Run the focused test and confirm it fails because the modules do not exist**

Run: `npm test -- tests/chat-contracts.test.ts`

- [ ] **Step 3: Implement strict Zod discriminated unions**

Define source references, 2–5 Smart Reply options, question/final turns, copy suggestions, include/exclude recommendations, stream events, and request selection metadata. Export inferred TypeScript types from the schemas so API and client share one contract.

- [ ] **Step 4: Implement the exact localized stage map from the approved spec**

Use all eight stages: `analyzing`, `researching`, `identity_check`, `concept`, `copywriting`, `prompting`, `quality_check`, and `finalizing`.

- [ ] **Step 5: Run the focused test and commit**

Run: `npm test -- tests/chat-contracts.test.ts`

Commit: `feat: add structured chat contracts`

### Task 2: Bilingual prompt rules and official-asset safety

**Files:**
- Modify: `lib/ui/chat-instructions.ts`
- Modify: `lib/ui/image-prompt-policy.ts`
- Modify: `lib/ui/creation-settings.ts`
- Test: `tests/chat-instructions.test.ts`
- Test: `tests/image-prompt-policy.test.ts`
- Test: `tests/creation-settings.test.ts`

**Interfaces:**
- Produces: `promptSections(language)`, `validateFinalPrompt(prompt, language)`, `buildResearchChatInstructions(settings)`.
- Consumes: existing `CreationSettings`, `TargetPlatform`, `PromptLanguage`, and `VariantCount`.

- [ ] **Step 1: Replace English-only expectations with failing bilingual tests**

```ts
const thai = buildChatInstructions({ platform: 'chatgpt', language: 'th', variantCount: 1 });
expect(thai).toContain('ตอบผู้ใช้และเขียนพรอมต์ฉบับสมบูรณ์เป็นภาษาไทยระดับมืออาชีพ');
expect(thai).toContain('ห้ามสร้างหรือเลียนแบบตราสัญลักษณ์');

expect(validateFinalPromptResponse(thaiPromptBlock, 1, 'th').ok).toBe(true);
expect(validateFinalPromptResponse(englishPromptBlock, 1, 'en').ok).toBe(true);
expect(validateFinalPromptResponse(thaiPromptBlock, 1, 'en').ok).toBe(false);
```

- [ ] **Step 2: Run tests and confirm failure is caused by the current English-only policy**

Run: `npm test -- tests/chat-instructions.test.ts tests/image-prompt-policy.test.ts tests/creation-settings.test.ts`

- [ ] **Step 3: Implement language-specific required sections and validation**

Thai sections are `หัวข้อและสื่อ`, `องค์ประกอบและรายละเอียด`, `สีและแสง`, `องค์ประกอบและการจัดวาง`, `คำแนะนำพื้นที่ข้อความ`, and `พารามิเตอร์`. English retains the existing labels. Both languages retain new-image semantics and reject edit-existing wording unless explicitly allowed.

- [ ] **Step 4: Add research, copywriting, and identity rules to the system instructions**

The instruction must distinguish verified facts, user-provided facts, and creative suggestions; require official-source preference; forbid invented official assets; request authentic assets; and produce the structured output contract instead of Markdown heuristics.

- [ ] **Step 5: Run focused tests and commit**

Run: `npm test -- tests/chat-instructions.test.ts tests/image-prompt-policy.test.ts tests/creation-settings.test.ts`

Commit: `feat: support bilingual researched prompts`

### Task 3: NDJSON codec and client stream reader

**Files:**
- Create: `lib/chat/ndjson.ts`
- Test: `tests/chat-ndjson.test.ts`

**Interfaces:**
- Produces: `encodeChatEvent(event): string`, `readChatEventStream(response, onEvent): Promise<void>`.
- Consumes: `ChatStreamEventSchema` from Task 1.

- [ ] **Step 1: Write failing tests for split chunks, multiple events, malformed lines, and terminal events**

```ts
const response = responseFromChunks(['{"type":"stage",', '"stage":"researching"}\n', '{"type":"done","requestId":"r1"}\n']);
await readChatEventStream(response, event => events.push(event));
expect(events.map(event => event.type)).toEqual(['stage', 'done']);
```

- [ ] **Step 2: Run the test and verify module-not-found failure**

Run: `npm test -- tests/chat-ndjson.test.ts`

- [ ] **Step 3: Implement newline framing with `TextDecoder` streaming mode**

Reject non-OK responses, parse every completed line with `ChatStreamEventSchema`, parse the final buffer, and throw a localized-safe protocol error for malformed events.

- [ ] **Step 4: Run focused tests and commit**

Run: `npm test -- tests/chat-ndjson.test.ts`

Commit: `feat: add chat event streaming codec`

### Task 4: Research-aware OpenAI orchestration and quality gate

**Files:**
- Create: `lib/chat/research.ts`
- Create: `lib/chat/orchestrator.ts`
- Create: `lib/chat/quality-gate.ts`
- Test: `tests/chat-research.test.ts`
- Test: `tests/chat-quality-gate.test.ts`

**Interfaces:**
- Produces: `runResearchChat(input, emitStage, dependencies): Promise<AssistantTurn>`, `normalizeSources(response): SourceRef[]`, `validateAssistantTurnQuality(turn, settings)`.
- Consumes: OpenAI `responses.create`, the structured contracts, bilingual instructions, and prompt policy.

- [ ] **Step 1: Write failing behavior tests using dependency injection**

Tests must prove that a final job calls a research dependency, an official organization emits `identity_check`, a generic creative job still performs research, missing official assets produce a warning/reserved-space instruction, invalid structured output triggers one repair, and a second invalid result throws `PROMPT_FORMAT_FAILED`.

- [ ] **Step 2: Run focused tests and verify expected missing-function failures**

Run: `npm test -- tests/chat-research.test.ts tests/chat-quality-gate.test.ts`

- [ ] **Step 3: Implement one bounded Responses API call with web search and JSON schema**

Use `model: process.env.NERAMIT_RESEARCH_MODEL || 'gpt-5.6-luna'`, `store: false`, `tools: [{ type: 'web_search' }]`, and `text.format` with the strict assistant-turn JSON schema. Include source details where supported and normalize URL citations into `SourceRef` records.

- [ ] **Step 4: Implement real stage emissions around actual work**

Emit `analyzing` before intent preparation, `researching` immediately before the web-search request, `identity_check` only when the request names an organization/official work, `concept`/`copywriting`/`prompting` before structured generation, `quality_check` before validation, and `finalizing` before returning.

- [ ] **Step 5: Implement one repair pass and fail-closed policy**

High-risk official/factual work must not silently continue after research failure. Generic work can return a clearly labeled warning without factual claims. All prompt variants pass the language-aware quality gate.

- [ ] **Step 6: Run focused tests and commit**

Run: `npm test -- tests/chat-research.test.ts tests/chat-quality-gate.test.ts`

Commit: `feat: orchestrate researched chat turns`

### Task 5: Streamed API route and backward-compatible persistence

**Files:**
- Modify: `app/api/chat/route.ts`
- Create: `lib/chat/persistence.ts`
- Create: `supabase/migrations/<generated>_add_chat_message_metadata.sql`
- Test: `tests/chat-route-helpers.test.ts`

**Interfaces:**
- Produces: NDJSON `POST /api/chat`, device-scoped persistence, idempotent `requestId` handling.
- Consumes: Tasks 1, 3, and 4.

- [ ] **Step 1: Create a migration with the Supabase CLI**

Run: `supabase migration new add_chat_message_metadata`

Migration body:

```sql
alter table public.chat_messages
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists chat_messages_request_id_idx
  on public.chat_messages ((metadata ->> 'requestId'))
  where metadata ? 'requestId';
```

- [ ] **Step 2: Write failing tests for request validation, idempotency keys, text summaries, and stream error serialization**

Run: `npm test -- tests/chat-route-helpers.test.ts`

- [ ] **Step 3: Implement persistence helpers**

Store readable `content` plus `metadata.turn`, `metadata.requestId`, research source references, and selected-card metadata. Query by draft ID and metadata request ID before inserting duplicate assistant output. Keep all draft queries scoped by `device_id`.

- [ ] **Step 4: Replace the JSON route response with a `ReadableStream` NDJSON response**

Validate the request with `ChatRequestSchema`, persist the user turn, run the orchestrator, emit stage/turn/done events, persist the assistant turn and updated brief, and emit a structured localized error when the pipeline fails.

- [ ] **Step 5: Preserve the old JSON path behind the disabled feature flag**

When `NERAMIT_RESEARCH_CHAT_V2 !== 'true'`, retain the current endpoint behavior so rollout can be reversed without database rollback.

- [ ] **Step 6: Run route tests and commit**

Run: `npm test -- tests/chat-route-helpers.test.ts`

Commit: `feat: stream and persist structured chat turns`

### Task 6: Smart Reply Cards, live status, and structured result UI

**Files:**
- Create: `components/chat/SmartReplyCards.tsx`
- Create: `components/chat/StructuredAssistantTurn.tsx`
- Modify: `components/ui/LoadingStates.tsx`
- Modify: `components/ChatClient.tsx`
- Modify: `lib/ui/chat-send.ts`
- Modify: `app/chat-polish.css`
- Test: `tests/chat-smart-reply.test.ts`
- Test: `tests/chat-send.test.ts`

**Interfaces:**
- Produces: optimistic card selection, custom-answer flow, localized `WorkStatusBubble`, structured prompt/copy/source rendering.
- Consumes: Tasks 1 and 3.

- [ ] **Step 1: Write failing pure behavior tests for selection state and request payloads**

```ts
expect(buildSmartReplyMessage(option)).toEqual({ label: 'ทางการ', value: 'formal' });
expect(isReplyGroupActive(3, 3, false)).toBe(true);
expect(isReplyGroupActive(3, 4, false)).toBe(false);
```

- [ ] **Step 2: Run tests and confirm missing behavior**

Run: `npm test -- tests/chat-smart-reply.test.ts tests/chat-send.test.ts`

- [ ] **Step 3: Implement accessible Smart Reply Cards**

Use semantic buttons with visible focus, 2–5 options, a disabled selected/stale state, and a custom input for `kind: 'custom'`. Selection appends the visible label immediately and sends both label and stable value.

- [ ] **Step 4: Implement `WorkStatusBubble`**

Accept `{ stage, language, elapsedSeconds? }`, render the exact Task 1 label, retain the current typing-dot visual, and announce changes through one polite live region.

- [ ] **Step 5: Upgrade `ChatClient` to consume NDJSON**

Use `crypto.randomUUID()` for each request, update stage from stream events, render `AssistantTurn`, retain legacy Markdown rendering for old rows/fallback mode, preserve optimistic text send, and stop busy state only on `done` or `error`.

- [ ] **Step 6: Render structured final results**

Render copyable prompt variants, copy suggestions, missing facts, include/exclude recommendations, warnings, and clickable source links. Copy buttons copy only prompt content. Labels localize from `settings.language`.

- [ ] **Step 7: Add responsive styles without changing the design system**

Cards stack on narrow screens and form a compact grid on larger screens. Preserve current colors/radii, minimum 44px tap targets, iOS safe area, and reduced-motion behavior.

- [ ] **Step 8: Run focused tests and commit**

Run: `npm test -- tests/chat-smart-reply.test.ts tests/chat-send.test.ts`

Commit: `feat: add smart replies and live chat status`

### Task 7: Full verification and Preview deployment

**Files:**
- Modify only files required to fix evidence-backed failures.

**Interfaces:**
- Produces: verified feature branch and Vercel Preview.
- Consumes: all previous tasks.

- [ ] **Step 1: Run the complete local quality gate**

Run:

```bash
npm test
npm run typecheck
npm run build
```

- [ ] **Step 2: Inspect the complete diff and secret scan**

Run:

```bash
git diff --check
git status --short
git diff --stat 69c7775...HEAD
git grep -nE 'OPENAI_API_KEY=|SUPABASE_SERVICE_ROLE_KEY=|CRON_SECRET=' -- . ':!*.md'
```

- [ ] **Step 3: Apply and verify the Supabase migration**

Use the connected Supabase project, verify `metadata` exists with default `{}`, insert/select a safe test row only if an isolated transaction is available, and run database advisors before rollout.

- [ ] **Step 4: Push the feature branch and open a GitHub PR**

Push `feat/research-smart-replies`, create a PR to `main`, and wait for GitHub CI plus Vercel Preview to reach a terminal state.

- [ ] **Step 5: Browser-verify the complete Preview story**

Verify Thai and English modes, text sending, Smart Reply selection, “Other”, real status transitions, structured final response, prompt-only copy, mobile layout, no console errors, and an official-institution logo scenario.

- [ ] **Step 6: Check Preview runtime logs**

Confirm no uncaught `/api/chat` errors, malformed stream events, OpenAI capability errors, or Supabase persistence errors.

### Task 8: Merge, Production enablement, and post-deploy verification

**Files:**
- No source changes unless an evidence-backed production-only failure is discovered.

**Interfaces:**
- Produces: GitHub `main` and Vercel Production running the verified commit.
- Consumes: verified Preview and applied database migration.

- [ ] **Step 1: Merge only after all required checks pass**

Record the merge commit SHA and verify Vercel associates the Production deployment with that SHA.

- [ ] **Step 2: Configure and enable the feature flag**

Set `NERAMIT_RESEARCH_CHAT_V2=true` and, if needed, `NERAMIT_RESEARCH_MODEL=gpt-5.6-luna` for Production without exposing values to the browser.

- [ ] **Step 3: Promote or deploy the exact verified artifact**

Prefer Vercel promotion of the verified Preview artifact. If Git integration builds `main`, wait for that exact commit to become `READY` before testing.

- [ ] **Step 4: Smoke-test Production end to end**

Check `https://neramittt.vercel.app/chat` in Thai and English, complete one researched prompt flow, verify Smart Reply/Card behavior and prompt copying, and confirm official-logo safeguards.

- [ ] **Step 5: Scan post-deploy errors and report evidence**

Inspect Vercel runtime errors for the production deployment, confirm the final GitHub/Vercel/Supabase state, and report the production URL, deployment status, commit SHA, checks, and any remaining operational limits.
