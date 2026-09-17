# Neramit UI Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild all eight Neramit frontend routes to closely match the approved desktop/mobile mockups while preserving the working Vercel + Supabase + OpenAI backend.

**Architecture:** Keep existing API contracts and route handlers unchanged. Introduce a small reusable UI system in `components/ui`, shared app shell/header components, responsive CSS tokens, and page-specific client components. Async interactions receive explicit loading, success, error, and reduced-motion states.

**Tech Stack:** Next.js 15, React 19, TypeScript, CSS, Vitest, Vercel, Supabase.

**Spec:** `docs/superpowers/specs/2026-09-17-neramit-ui-overhaul-design.md`

## Global Constraints

- Preserve routes `/`, `/chat`, `/form`, `/references`, `/review`, `/result`, `/history`, `/admin`.
- Preserve all existing backend API contracts unless a verified frontend bug requires a compatible change.
- Do not expose secrets to the browser.
- No raw JSON on normal user-facing screens.
- Touch targets should be approximately 44px or larger.
- Support mobile, tablet, desktop, and `prefers-reduced-motion`.
- Every real network/AI wait must have a visible loading state.
- Chat must show an AI thinking animation while awaiting `/api/chat`.

---

### Task 1: Shared visual foundation

**Files:**
- Create: `components/ui/AppHeader.tsx`
- Create: `components/ui/BrandMark.tsx`
- Create: `components/ui/LoadingStates.tsx`
- Create: `components/ui/Toast.tsx`
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`
- Test: `tests/ui-format.test.ts`

**Interfaces:**
- Produces `AppHeader`, `BrandMark`, `LoadingOverlay`, `AiThinkingBubble`, `SkeletonBlock`, and shared CSS utility classes used by all pages.

- [ ] Step 1: Add failing tests for shared formatting helpers/loading labels.
- [ ] Step 2: Run `npm test` and confirm the new tests fail because helpers do not exist.
- [ ] Step 3: Implement shared components and global design tokens.
- [ ] Step 4: Run `npm test`, `npm run typecheck`, and `npm run build`.
- [ ] Step 5: Commit `feat(ui): add Neramit design system foundation`.

### Task 2: Home + Chat

**Files:**
- Modify: `components/HomeClient.tsx`
- Modify: `components/ChatClient.tsx`
- Modify: `app/chat/page.tsx`
- Modify: `app/globals.css`
- Test: `tests/ui-format.test.ts`

**Interfaces:**
- Home continues calling `POST /api/device` for quota.
- Chat continues using `POST /api/drafts` and `POST /api/chat` with the existing device token header.

- [ ] Step 1: Add failing tests for chat summary extraction and pending-label state.
- [ ] Step 2: Confirm tests fail.
- [ ] Step 3: Implement mockup-matched Home, two-column Chat, live summary, optimistic user bubble, AI thinking bubble, styled error feedback, responsive mobile summary, and anchored composer.
- [ ] Step 4: Run tests/typecheck/build.
- [ ] Step 5: Commit `feat(ui): rebuild home and chat experience`.

### Task 3: Quick Form + References

**Files:**
- Modify: `components/QuickForm.tsx`
- Modify: `components/ReferencesClient.tsx`
- Modify: `app/form/page.tsx`
- Modify: `app/references/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Preserve draft create/update and reference upload/analyze/update/delete APIs.

- [ ] Step 1: Add failing tests for human-readable form/reference labels.
- [ ] Step 2: Confirm tests fail.
- [ ] Step 3: Rebuild Quick Form into grouped responsive sections and References into gallery + selected preview + analysis/aspect controls with upload/analyze loading states.
- [ ] Step 4: Run tests/typecheck/build.
- [ ] Step 5: Commit `feat(ui): rebuild form and reference review`.

### Task 4: Review + Result

**Files:**
- Modify: `components/ReviewClient.tsx`
- Modify: `components/ResultClient.tsx`
- Modify: `app/review/page.tsx`
- Modify: `app/result/page.tsx`
- Modify: `app/globals.css`
- Test: `tests/ui-format.test.ts`

**Interfaces:**
- Review continues reading `/api/review` and calling `/api/generate`.
- Result consumes existing prompt generation payload.

- [ ] Step 1: Add failing tests that transform brief fields into Thai display rows and prompt variants into tab labels.
- [ ] Step 2: Confirm tests fail.
- [ ] Step 3: Remove raw JSON, implement human-readable summary cards, generation overlay, variant tabs, copy success, usage guidance, and saved-history state.
- [ ] Step 4: Run tests/typecheck/build.
- [ ] Step 5: Commit `feat(ui): rebuild review and result screens`.

### Task 5: History + Admin

**Files:**
- Modify: `components/HistoryClient.tsx`
- Modify: `components/AdminClient.tsx`
- Modify: `app/history/page.tsx`
- Modify: `app/admin/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Preserve current history and admin APIs/authentication.

- [ ] Step 1: Add failing tests for history/admin display helpers where applicable.
- [ ] Step 2: Confirm tests fail.
- [ ] Step 3: Implement mockup-matched history search/filter/cards/actions/confirmations and responsive admin KPI/dashboard/recent-jobs/control panels.
- [ ] Step 4: Run tests/typecheck/build.
- [ ] Step 5: Commit `feat(ui): rebuild history and admin dashboard`.

### Task 6: Cross-device polish + production verification

**Files:**
- Modify: `app/globals.css`
- Modify only page/client files with verified responsive issues.

**Interfaces:**
- No API changes.

- [ ] Step 1: Verify CSS breakpoints for 360, 390, 430, 768, 834, 1024, 1280, and 1440px compositions by inspecting preview output and route rendering.
- [ ] Step 2: Fix overflow, wrapping, touch target, safe-area, card-size, and typography issues found.
- [ ] Step 3: Run `npm test`, `npm run typecheck`, and `npm run build` fresh.
- [ ] Step 4: Create a Vercel preview from the feature branch and smoke-check all eight routes plus core API statuses.
- [ ] Step 5: Open a PR to `main` with verification evidence; merge only after all checks are green.
