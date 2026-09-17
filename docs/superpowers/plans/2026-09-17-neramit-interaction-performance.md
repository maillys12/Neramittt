# Neramit Interaction and Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the approved Neramit design while replacing emoji controls with custom SVG icons, making AI/language/variant selectors real, and reducing chat latency.

**Architecture:** Add a small shared UI/settings layer, persist creation settings inside each draft brief, and thread those settings through Chat, Form, Review, and Generate. Optimize the `/api/chat` hot path by eliminating redundant client refreshes and unnecessary settings queries while keeping Supabase and OpenAI server-side.

**Tech Stack:** Next.js 15, React 19, TypeScript, CSS, Supabase, OpenAI Responses API, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-17-neramit-interaction-performance-design.md`

## Global Constraints
- Preserve approved Neramit layout, gradients, card shapes, hierarchy, mascot direction, and color mood.
- No emoji in functional UI.
- Platform values: `chatgpt | gemini | canva | generic`.
- Language values: `th | en`.
- Variant counts: `1 | 2 | 3`.
- Existing backend security boundaries remain unchanged.
- `npm test`, `npm run typecheck`, and `npm run build` must pass before merge.

---

### Task 1: Shared creation settings

**Files:**
- Create: `lib/ui/creation-settings.ts`
- Create: `tests/creation-settings.test.ts`

**Interfaces:**
- Produces: `CreationSettings`, `normalizeCreationSettings(brief)`, `settingsPatch(settings)`, `platformInstruction(platform)`, `languageInstruction(language)`.

- [ ] Write failing tests covering defaults, normalization, and target instructions.
- [ ] Run `npm test -- creation-settings` and confirm failure.
- [ ] Implement the helpers with exact enum values from the spec.
- [ ] Run the focused tests and confirm pass.
- [ ] Commit.

### Task 2: Custom Neramit SVG icon system

**Files:**
- Create: `components/ui/NeramitIcon.tsx`
- Modify: `components/ChatClient.tsx`
- Modify: `components/QuickForm.tsx`
- Modify: `components/ReferencesClient.tsx`
- Modify: `components/ReviewClient.tsx`
- Modify: `components/ResultClient.tsx`
- Modify: `components/HistoryClient.tsx`
- Modify: `components/AdminClient.tsx`
- Modify: `components/ui/AppHeader.tsx`
- Modify: `app/chat/page.tsx`
- Modify: `app/form/page.tsx`
- Modify: `app/references/page.tsx`
- Modify: `app/review/page.tsx`
- Modify: `app/result/page.tsx`
- Modify: `app/history/page.tsx`
- Modify: `app/admin/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Produces: `NeramitIcon({name,size,className})` with `currentColor` SVG paths and consistent rounded strokes.

- [ ] Add the icon component with named icons for chat, document, globe, layers, search, edit, lock, image, settings, history, refresh, send, spark, user, chevronDown, chevronLeft, chevronRight, upload, palette.
- [ ] Replace functional emoji glyphs with icons while preserving labels and layout.
- [ ] Add CSS for icon sizing/alignment without changing the approved visual direction.
- [ ] Run typecheck.
- [ ] Commit.

### Task 3: Functional AI/language/variant controls

**Files:**
- Create: `components/ui/CreationSettingsControls.tsx`
- Modify: `components/ChatClient.tsx`
- Modify: `components/QuickForm.tsx`
- Modify: `components/ReviewClient.tsx`
- Modify: `app/api/drafts/[id]/route.ts`
- Test: `tests/creation-settings.test.ts`

**Interfaces:**
- `CreationSettingsControls` consumes `CreationSettings`, `onChange`, and optional compact mode.
- Draft brief stores `target_platform`, `prompt_language`, `variant_count`.

- [ ] Add tests proving persisted brief keys normalize correctly.
- [ ] Build accessible popover/select controls with real state changes.
- [ ] Persist changes optimistically to an existing draft via PATCH; keep local state if draft does not exist yet.
- [ ] Include settings in newly created chat/form drafts.
- [ ] Ensure Review reads the saved values and variant buttons update the same state.
- [ ] Run focused tests and typecheck.
- [ ] Commit.

### Task 4: Make Generate honor settings

**Files:**
- Modify: `app/api/generate/route.ts`
- Modify: `components/ReviewClient.tsx`
- Modify: `components/ResultClient.tsx`
- Test: `tests/creation-settings.test.ts`

**Interfaces:**
- Generate derives target platform/language/variant count from normalized draft settings, with request `variantCount` remaining a validated override for backwards compatibility.

- [ ] Add failing tests for platform/language instruction mapping.
- [ ] Update generation prompt to include explicit target-platform formatting and requested prompt language.
- [ ] Persist result metadata so Result can label the target platform/language correctly.
- [ ] Run tests and typecheck.
- [ ] Commit.

### Task 5: Reduce chat hot-path latency

**Files:**
- Modify: `app/api/chat/route.ts`
- Modify: `components/ChatClient.tsx`
- Modify: `lib/openai/client.ts` only if required by SDK typing.
- Create: `tests/chat-response-shape.test.ts`

**Interfaces:**
- `/api/chat` returns `{ok,message,brief}` so client does not need a follow-up draft GET.

- [ ] Add a test for the new response-shape helper/brief merge behavior.
- [ ] Remove the `chat_max_messages` database lookup from the hot path and use a bounded constant.
- [ ] Keep only the most recent bounded conversation context needed for creative brief collection.
- [ ] Configure the chat model for fast short-form responses with low/no reasoning and concise output.
- [ ] Return the updated brief directly from `/api/chat` and delete the client's `refreshBrief()` round trip.
- [ ] Keep the thinking bubble visible immediately and update the brief when the response lands.
- [ ] Run tests, typecheck, and build.
- [ ] Commit.

### Task 6: Premium polish without redesign

**Files:**
- Modify: `app/globals.css`
- Modify: `components/ui/CreationSettingsControls.tsx`
- Modify: `components/ui/LoadingStates.tsx`

**Interfaces:**
- No API changes.

- [ ] Reduce selector visual weight when inactive, keep 44px+ touch targets, and use consistent 8/12/16/24 spacing rhythm.
- [ ] Soften separators and secondary text contrast while preserving Neramit colors.
- [ ] Ensure loading states do not shift layout and respect reduced-motion preferences.
- [ ] Verify phone/tablet/desktop breakpoints from existing CSS.
- [ ] Commit.

### Task 7: Verification and release

**Files:**
- No new source files unless fixes are required.

- [ ] Run `npm test`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Open a PR from `feat/interaction-performance-pass` to `main`.
- [ ] Verify Vercel Preview is READY and inspect `/`, `/chat`, `/form`, `/review`, and `/result` responses.
- [ ] Check recent preview runtime errors/logs.
- [ ] Merge only after all checks pass.
- [ ] Verify production deployment is READY and check runtime errors again.
