# Neramit Vercel + Supabase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Neramit as a Next.js application on Vercel with Supabase PostgreSQL/Storage, preserving the existing no-login device flow, Chat, Quick Form, references, review, generation, history, quota, and admin features.

**Architecture:** Keep the legacy Google Apps Script files untouched during migration and place the new application under `web/`. Vercel serves `web/` as the project root. All privileged operations run in Next.js route handlers using server-only Supabase and OpenAI credentials; the browser stores only the anonymous device token and client-safe configuration.

**Tech Stack:** Next.js 15+, React 19+, TypeScript 5+, Tailwind CSS 4+, Vitest, Testing Library, Supabase JS, PostgreSQL, Supabase Storage, OpenAI API, Vercel Functions/Cron.

**Spec:** `docs/superpowers/specs/2026-09-17-neramit-vercel-supabase-migration-design.md`

## Global Constraints

- Repository: `maillys12/Neramittt`.
- Migration branch: `migration/vercel-supabase`; do not modify `main` until verification is complete.
- New web app lives under `web/`; legacy Apps Script files remain in place until production cutover.
- Supabase project: `Neramit`, project ref `ulczxopzyclihsvuavzc`, region `ap-southeast-1`.
- No historical Google Sheets or Google Drive data migration.
- Preserve localStorage key `neramit_device_token_v1`.
- No user registration or Google login.
- OpenAI keys and Supabase service-role credentials are server-only.
- Reference uploads accept JPEG, PNG, WebP and max 4 images per draft.
- Prompt generation supports 1–3 variants.
- Device suspension and quota checks are enforced server-side.
- User-facing copy is Thai-first and concise.
- Normal UI interactions must not wait on a server call unless data or AI work is genuinely required.
- Exact poster text supplied by a user must remain unchanged when requested.

---

### Task 1: Scaffold the Next.js application and test harness

**Files:**
- Create: `web/package.json`
- Create: `web/tsconfig.json`
- Create: `web/next.config.ts`
- Create: `web/postcss.config.mjs`
- Create: `web/app/layout.tsx`
- Create: `web/app/page.tsx`
- Create: `web/app/globals.css`
- Create: `web/vitest.config.ts`
- Create: `web/tests/setup.ts`
- Create: `web/tests/smoke/home.test.tsx`
- Create: `web/.env.example`

**Interfaces:**
- Produces a buildable Next.js app rooted at `web/`.
- Produces `npm run test`, `npm run typecheck`, and `npm run build` verification commands.

- [ ] **Step 1: Add a failing home-page smoke test**

```tsx
import { render, screen } from '@testing-library/react';
import HomePage from '@/app/page';

test('renders Neramit home entry points', () => {
  render(<HomePage />);
  expect(screen.getByText('สร้างพรอมต์ดี ๆ ได้ง่ายกว่าที่คิด')).toBeInTheDocument();
  expect(screen.getByText('คุยกับ Neramit')).toBeInTheDocument();
  expect(screen.getByText('แบบฟอร์มด่วน')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test and confirm it fails before implementation**

Run: `cd web && npm test -- --run tests/smoke/home.test.tsx`
Expected: failure because the Next.js app does not exist yet.

- [ ] **Step 3: Create the Next.js package configuration**

`web/package.json` must include scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

Dependencies must include `next`, `react`, `react-dom`, `@supabase/supabase-js`, `zod`, and `openai`. Dev dependencies must include TypeScript, Tailwind/PostCSS packages, Vitest, jsdom, Testing Library, and React type packages.

- [ ] **Step 4: Implement the minimal home shell**

`web/app/page.tsx` must render the approved Neramit headline and the two entry cards. `web/app/layout.tsx` must use Thai metadata and load a Thai-readable system/font stack. `globals.css` must define the existing cream/light background, purple/pink gradient accents, rounded cards, focus-visible states, and reduced-motion behavior.

- [ ] **Step 5: Verify the app scaffold**

Run:

```bash
cd web
npm install
npm test -- --run tests/smoke/home.test.tsx
npm run typecheck
npm run build
```

Expected: all commands succeed.

- [ ] **Step 6: Commit**

```bash
git add web
git commit -m "feat: scaffold Neramit Next.js app"
```

---

### Task 2: Create the Supabase schema, storage bucket, constraints, and atomic quota functions

**Files:**
- Create: `web/supabase/migrations/202609170001_initial_schema.sql`
- Create: `web/supabase/migrations/202609170002_quota_functions.sql`
- Create: `web/supabase/migrations/202609170003_storage_policies.sql`
- Create: `web/lib/supabase/database.types.ts`
- Create: `web/tests/db/schema.contract.test.ts`

**Interfaces:**
- Produces tables: `devices`, `drafts`, `chat_messages`, `reference_images`, `prompt_jobs`, `prompts`, `daily_usage`, `settings`, `admin_sessions`, `admin_audit_logs`, `error_logs`.
- Produces private bucket `reference-images`.
- Produces SQL function `reserve_prompt_quota(p_device_id uuid, p_request_id text, p_daily_limit integer, p_variant_count integer)`.
- Produces SQL function `finalize_prompt_quota(p_request_id text, p_success boolean)`.

- [ ] **Step 1: Write the schema contract test**

The test reads the migration SQL and verifies that all required tables, unique constraints, check constraints, RLS statements, the private bucket, and both quota functions are present.

```ts
const required = [
  'devices','drafts','chat_messages','reference_images','prompt_jobs',
  'prompts','daily_usage','settings','admin_sessions','admin_audit_logs','error_logs'
];
for (const table of required) expect(sql).toContain(`create table if not exists public.${table}`);
expect(sql).toContain("reference-images");
expect(quotaSql).toContain('reserve_prompt_quota');
expect(quotaSql).toContain('finalize_prompt_quota');
```

- [ ] **Step 2: Run the contract test and confirm failure**

Run: `cd web && npm test -- --run tests/db/schema.contract.test.ts`
Expected: failure because migration files do not exist.

- [ ] **Step 3: Implement the initial schema**

The migration must:
- enable `pgcrypto`;
- create UUID primary keys using `gen_random_uuid()`;
- add foreign keys with cascade behavior where the spec requires it;
- add status checks for `devices.status` and `prompt_jobs.status`;
- add mode/role checks for `drafts.mode` and `chat_messages.role`;
- add indexes on `(device_id, created_at desc)`, `(draft_id, created_at)`, `expires_at`, and history lookup columns;
- enable RLS on all user-data and admin tables;
- insert default settings using `insert ... on conflict do nothing`.

- [ ] **Step 4: Implement atomic quota functions**

`reserve_prompt_quota` must lock the device/day usage row, return an existing `prompt_jobs` row when `request_id` already exists, reject suspended devices, reject quota exhaustion, increment `reserved_count`, and insert a queued job exactly once.

`finalize_prompt_quota` must lock the job and usage row, move one reservation to `used_count` only on a successful terminal completion, release the reservation on failure, and remain idempotent if called repeatedly.

- [ ] **Step 5: Add private storage configuration**

Create bucket `reference-images` with `public = false`. Do not create broad client upload/read policies; application access will occur through server-side route handlers.

- [ ] **Step 6: Apply migrations to Supabase project `ulczxopzyclihsvuavzc` and generate TypeScript types**

Expected result: all migrations apply successfully and generated types are saved to `web/lib/supabase/database.types.ts`.

- [ ] **Step 7: Run security and performance advisors**

Fix actionable RLS, index, or function-security warnings before moving on.

- [ ] **Step 8: Commit**

```bash
git add web/supabase web/lib/supabase/database.types.ts web/tests/db
git commit -m "feat: add Supabase schema and quota functions"
```

---

### Task 3: Add server-side Supabase clients, device identity, ownership guards, and API response helpers

**Files:**
- Create: `web/lib/supabase/server.ts`
- Create: `web/lib/device/token.ts`
- Create: `web/lib/device/server.ts`
- Create: `web/lib/http/api.ts`
- Create: `web/lib/validation/common.ts`
- Create: `web/app/api/device/init/route.ts`
- Create: `web/tests/device/token.test.ts`
- Create: `web/tests/device/init-route.test.ts`

**Interfaces:**
- Produces `hashDeviceToken(token: string): string`.
- Produces `requireDevice(request: Request): Promise<DeviceContext>`.
- Produces `jsonOk(data, init?)` and `jsonError(message, status, code?)`.
- API header for device authentication: `x-neramit-device-token`.

- [ ] **Step 1: Write failing token and init-route tests**

Tests must verify a stable SHA-256 hash, rejection of missing/short tokens, creation of a new device row, update of `last_seen_at`, and rejection of suspended devices for protected generation actions.

- [ ] **Step 2: Run tests and confirm failure**

Run: `cd web && npm test -- --run tests/device`
Expected: failure because device helpers do not exist.

- [ ] **Step 3: Implement server-only Supabase client**

Use `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from server environment variables. Throw during request handling if either is missing. Never import this module into a client component.

- [ ] **Step 4: Implement device hashing and ownership guard**

Use `crypto.createHash('sha256')`. The raw browser token must never be stored in Supabase. `requireDevice` reads `x-neramit-device-token`, hashes it, upserts/loads the device, and returns `{ id, status }`.

- [ ] **Step 5: Implement `/api/device/init`**

Return `{ deviceId, status, quota: { used, reserved, limit, remaining } }`. Read the daily limit from `settings` with a safe server fallback of 10.

- [ ] **Step 6: Verify**

Run: `cd web && npm test -- --run tests/device && npm run typecheck`.

- [ ] **Step 7: Commit**

```bash
git add web/lib web/app/api/device web/tests/device
git commit -m "feat: add anonymous device identity"
```

---

### Task 4: Implement drafts, Quick Form, Chat persistence, and review data

**Files:**
- Create: `web/lib/drafts/repository.ts`
- Create: `web/lib/chat/service.ts`
- Create: `web/lib/openai/client.ts`
- Create: `web/app/api/drafts/route.ts`
- Create: `web/app/api/drafts/[id]/route.ts`
- Create: `web/app/api/drafts/[id]/review/route.ts`
- Create: `web/app/api/drafts/[id]/chat/route.ts`
- Create: `web/tests/drafts/draft-flow.test.ts`
- Create: `web/tests/chat/chat-service.test.ts`

**Interfaces:**
- `createDraft(deviceId, mode)` returns a draft DTO.
- `getOwnedDraft(deviceId, draftId)` rejects cross-device access.
- `updateDraft(deviceId, draftId, patch)` accepts validated brief data.
- `sendChatMessage(deviceId, draftId, content)` persists both user and assistant messages and updates the brief.

- [ ] **Step 1: Write failing draft ownership and chat-state tests**

Cover create/update/read, cross-device rejection, invalid mode, chat message ordering, and preservation of already answered fields.

- [ ] **Step 2: Run tests and confirm failure**

Run: `cd web && npm test -- --run tests/drafts tests/chat`.

- [ ] **Step 3: Implement draft repository and Zod validation**

The draft `brief` JSON accepts structured fields used by both modes: purpose, subject, style, composition, colors, background, aspect ratio, exact text, additional instructions, and selected reference usage.

- [ ] **Step 4: Implement OpenAI chat service**

System behavior must instruct the model to ask only for important missing information, not repeat answered questions, never invent user facts, and return a machine-readable brief patch plus the Thai assistant reply.

- [ ] **Step 5: Implement REST routes**

All routes call `requireDevice`, verify draft ownership, validate request bodies, and return concise Thai error messages without internal details.

- [ ] **Step 6: Verify**

Run: `cd web && npm test -- --run tests/drafts tests/chat && npm run typecheck`.

- [ ] **Step 7: Commit**

```bash
git add web/lib/drafts web/lib/chat web/lib/openai web/app/api/drafts web/tests/drafts web/tests/chat
git commit -m "feat: add drafts chat and review API"
```

---

### Task 5: Implement reference image upload, private previews, analysis, selection, and removal

**Files:**
- Create: `web/lib/references/service.ts`
- Create: `web/lib/references/validation.ts`
- Create: `web/app/api/drafts/[id]/references/route.ts`
- Create: `web/app/api/references/[id]/route.ts`
- Create: `web/app/api/references/[id]/preview/route.ts`
- Create: `web/app/api/references/[id]/analyze/route.ts`
- Create: `web/tests/references/references.test.ts`

**Interfaces:**
- Maximum 4 references per draft.
- MIME whitelist: `image/jpeg`, `image/png`, `image/webp`.
- Storage path format: `{deviceId}/{draftId}/{referenceId}.{ext}`.
- Analysis returns `colors`, `style`, `composition`, `subjects`, `background`, `visibleText`, `confidenceNotes`.

- [ ] **Step 1: Write failing upload and ownership tests**

Cover MIME rejection, size rejection, fifth-image rejection, cross-device access rejection, delete behavior, and analysis retry behavior.

- [ ] **Step 2: Run tests and confirm failure**

Run: `cd web && npm test -- --run tests/references`.

- [ ] **Step 3: Implement upload validation and private storage writes**

Read max upload size from `settings`. Upload through the server Supabase client only. Persist metadata after successful object upload; delete the object if metadata insert fails.

- [ ] **Step 4: Implement preview route**

Verify ownership before downloading/streaming the object or issuing a short-lived signed URL. Do not expose permanent public URLs.

- [ ] **Step 5: Implement OpenAI reference analysis**

Send the uploaded image to OpenAI through server-side code and normalize the structured result to the exact fields above. Store the result in `reference_images.analysis`.

- [ ] **Step 6: Implement usage selection and removal**

Allow the user to enable/disable analyzed aspects in `usage_options`. Deleting a reference deletes the storage object and its database row.

- [ ] **Step 7: Verify**

Run: `cd web && npm test -- --run tests/references && npm run typecheck`.

- [ ] **Step 8: Commit**

```bash
git add web/lib/references web/app/api/references web/app/api/drafts web/tests/references
git commit -m "feat: add private reference image workflow"
```

---

### Task 6: Implement prompt generation, quota idempotency, result persistence, and history

**Files:**
- Create: `web/lib/generation/service.ts`
- Create: `web/lib/quota/service.ts`
- Create: `web/lib/history/repository.ts`
- Create: `web/app/api/generate/route.ts`
- Create: `web/app/api/jobs/[id]/route.ts`
- Create: `web/app/api/history/route.ts`
- Create: `web/app/api/history/[id]/route.ts`
- Create: `web/app/api/history/[id]/clone/route.ts`
- Create: `web/tests/generation/idempotency.test.ts`
- Create: `web/tests/history/history.test.ts`

**Interfaces:**
- `POST /api/generate` body: `{ draftId, requestId, variantCount }`.
- `variantCount` must be integer 1–3.
- Repeated `requestId` returns the existing job.
- History uses cursor or page-based pagination with server-side filtering and soft deletion.

- [ ] **Step 1: Write failing duplicate-request and quota tests**

Simulate two requests with the same `requestId`; assert only one reservation and one prompt job exist. Verify failed terminal jobs release reservation and successful jobs consume exactly one unit.

- [ ] **Step 2: Run tests and confirm failure**

Run: `cd web && npm test -- --run tests/generation tests/history`.

- [ ] **Step 3: Implement quota service around the SQL RPC functions**

The TypeScript service must not emulate atomicity in application code. It calls the database functions and translates quota/suspension failures into stable API error codes.

- [ ] **Step 4: Implement prompt generation service**

Build the final instruction from the stored draft plus selected reference analysis only. Preserve exact user-provided poster text when `exactText` is present. Do not invent facts. Return exactly `variantCount` variants.

- [ ] **Step 5: Persist job and history results**

On successful generation, update the job, insert the completed history record, finalize quota success, and return result DTO. On terminal failure, record the error, finalize quota failure, and log internal details without exposing secrets.

- [ ] **Step 6: Implement history APIs**

Support list/search, detail, clone to a new draft, and soft delete using `deleted_at`. History queries must filter by current device.

- [ ] **Step 7: Verify**

Run: `cd web && npm test -- --run tests/generation tests/history && npm run typecheck`.

- [ ] **Step 8: Commit**

```bash
git add web/lib/generation web/lib/quota web/lib/history web/app/api/generate web/app/api/jobs web/app/api/history web/tests/generation web/tests/history
git commit -m "feat: add generation quota and history"
```

---

### Task 7: Implement admin authentication, audit log, dashboard, settings, and device controls

**Files:**
- Create: `web/lib/admin/auth.ts`
- Create: `web/lib/admin/repository.ts`
- Create: `web/app/api/admin/login/route.ts`
- Create: `web/app/api/admin/logout/route.ts`
- Create: `web/app/api/admin/dashboard/route.ts`
- Create: `web/app/api/admin/settings/route.ts`
- Create: `web/app/api/admin/devices/[id]/route.ts`
- Create: `web/app/api/admin/references/[id]/route.ts`
- Create: `web/tests/admin/auth.test.ts`
- Create: `web/tests/admin/controls.test.ts`

**Interfaces:**
- Admin auth uses `ADMIN_PASSWORD_HASH` and a random session token.
- Only the SHA-256 hash of the random session token is stored.
- Session cookie is `HttpOnly`, `Secure` in production, `SameSite=Lax`, and scoped to `/`.

- [ ] **Step 1: Write failing login/session/control tests**

Cover valid login, invalid login, expired session, suspended/reactivated device, settings update validation, audit insertion, and reference deletion.

- [ ] **Step 2: Run tests and confirm failure**

Run: `cd web && npm test -- --run tests/admin`.

- [ ] **Step 3: Implement password verification and session lifecycle**

Use a strong password hash format generated outside the browser. Generate 32 random bytes for session tokens. Store only the token hash and expiry in `admin_sessions`.

- [ ] **Step 4: Implement rate limiting for failed admin login**

Persist recent failed login metadata in a server-side mechanism backed by Supabase so serverless instances share state. Reject excessive attempts with HTTP 429.

- [ ] **Step 5: Implement dashboard and control routes**

Dashboard returns aggregate metrics and paginated recent jobs/errors/devices. Every mutating admin action writes `admin_audit_logs`.

- [ ] **Step 6: Verify**

Run: `cd web && npm test -- --run tests/admin && npm run typecheck`.

- [ ] **Step 7: Commit**

```bash
git add web/lib/admin web/app/api/admin web/tests/admin
git commit -m "feat: add secure Neramit admin API"
```

---

### Task 8: Rebuild the approved Neramit UI and connect it to the new API

**Files:**
- Create: `web/components/layout/AppHeader.tsx`
- Create: `web/components/layout/AppShell.tsx`
- Create: `web/components/ui/Button.tsx`
- Create: `web/components/ui/Card.tsx`
- Create: `web/components/ui/Input.tsx`
- Create: `web/components/ui/Modal.tsx`
- Create: `web/lib/device/client.ts`
- Create: `web/lib/api/client.ts`
- Create: `web/app/chat/page.tsx`
- Create: `web/app/form/page.tsx`
- Create: `web/app/references/page.tsx`
- Create: `web/app/review/page.tsx`
- Create: `web/app/result/page.tsx`
- Create: `web/app/history/page.tsx`
- Create: `web/app/admin/page.tsx`
- Create: `web/tests/ui/navigation.test.tsx`
- Create: `web/tests/ui/device-token.test.ts`

**Interfaces:**
- Browser device token is generated once with `crypto.randomUUID()` plus sufficient entropy and persisted under `neramit_device_token_v1`.
- `apiFetch()` automatically adds `x-neramit-device-token` for user APIs.
- UI routing is handled locally by Next.js; selections and form edits do not call the server until save/submit points.

- [ ] **Step 1: Write failing navigation and token-continuity tests**

Verify that an existing `neramit_device_token_v1` value is reused and that navigating between main pages does not regenerate it.

- [ ] **Step 2: Run tests and confirm failure**

Run: `cd web && npm test -- --run tests/ui`.

- [ ] **Step 3: Implement reusable UI primitives and shell**

Reproduce the approved Neramit visual language: light/cream surfaces, purple-pink gradients, soft shadows, rounded cards, responsive mobile layout, clear Thai typography, accessible focus styles, and reduced-motion support.

- [ ] **Step 4: Implement Home, Chat, Quick Form, References, Review, Result, History, and Admin pages**

Preserve the current product flow and copy structure. Use optimistic/local state for text entry and selections. Debounce draft persistence. Show loading states only for actual API/AI work.

- [ ] **Step 5: Implement reference upload UI**

Show up to four thumbnails, progress state, analysis state, retry, remove, and checkboxes/toggles for selected analysis aspects.

- [ ] **Step 6: Implement review and generation UX**

Review shows the complete brief, selected references, exact poster text, and variant count before the quota-consuming submit. Disable duplicate submission while a request is in flight and reuse the same generated `requestId` on retry.

- [ ] **Step 7: Verify UI tests and production build**

Run:

```bash
cd web
npm test -- --run tests/ui
npm run typecheck
npm run build
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add web/app web/components web/lib/api web/lib/device web/tests/ui
git commit -m "feat: rebuild Neramit UI for Vercel"
```

---

### Task 9: Add retention cleanup, error logging, environment validation, and Vercel configuration

**Files:**
- Create: `web/lib/config/env.ts`
- Create: `web/lib/logging/errors.ts`
- Create: `web/lib/cleanup/service.ts`
- Create: `web/app/api/cron/cleanup/route.ts`
- Create: `web/vercel.json`
- Update: `web/.env.example`
- Create: `web/tests/cleanup/cleanup.test.ts`
- Create: `web/tests/config/env.test.ts`

**Interfaces:**
- Cleanup route requires `CRON_SECRET`.
- Cleanup deletes expired storage objects before deleting expired database records.
- Required server variables: `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD_HASH`, `CRON_SECRET`.
- Public variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

- [ ] **Step 1: Write failing environment and cleanup tests**

Verify missing server secrets fail early, invalid cron secret returns 401, expired references remove storage objects, and completed prompt history remains.

- [ ] **Step 2: Run tests and confirm failure**

Run: `cd web && npm test -- --run tests/config tests/cleanup`.

- [ ] **Step 3: Implement environment parsing**

Use Zod to validate environment values in server-only code. Never include secret values in thrown/logged messages.

- [ ] **Step 4: Implement centralized internal error logging**

Insert normalized source/message/details into `error_logs`; strip authorization headers, raw device tokens, API keys, and cookies from metadata.

- [ ] **Step 5: Implement retention cleanup**

Read retention settings, locate expired references/drafts, delete storage objects, then remove database rows. Keep prompt history, admin audits, and errors according to their independent retention policy.

- [ ] **Step 6: Add Vercel cron configuration**

`web/vercel.json` schedules `/api/cron/cleanup` once daily. Route checks `Authorization: Bearer ${CRON_SECRET}`.

- [ ] **Step 7: Verify**

Run: `cd web && npm test -- --run tests/config tests/cleanup && npm run typecheck && npm run build`.

- [ ] **Step 8: Commit**

```bash
git add web/lib/config web/lib/logging web/lib/cleanup web/app/api/cron web/vercel.json web/.env.example web/tests/config web/tests/cleanup
git commit -m "feat: add cleanup and deployment safeguards"
```

---

### Task 10: Configure Vercel, deploy preview, run end-to-end verification, and prepare cutover

**Files:**
- Create: `web/README.md`
- Create: `docs/migration/neramit-cutover-checklist.md`

**Interfaces:**
- Vercel project uses GitHub repository `maillys12/Neramittt` and root directory `web`.
- Preview branch: `migration/vercel-supabase`.
- Production remains untouched until all checks pass.

- [ ] **Step 1: Discover the user's Vercel team and create/connect the Neramit project**

Configure project root directory as `web` and framework as Next.js.

- [ ] **Step 2: Add Vercel environment variables**

Add Supabase URL/publishable key, server service-role key, OpenAI key, admin password hash, and cron secret separately for Preview and Production. Do not commit secret values.

- [ ] **Step 3: Deploy the migration branch as a Vercel preview**

Expected: build succeeds and preview URL loads the new Neramit home page.

- [ ] **Step 4: Run end-to-end manual verification**

Verify on mobile and desktop:

```text
Home -> Chat -> Review -> Generate -> Result -> History
Home -> Quick Form -> References -> Analyze -> Review -> Generate -> Result
Admin -> Login -> Dashboard -> Suspend device -> Reactivate device -> Settings
```

Confirm normal navigation/form edits feel immediate and only API/AI operations show loading states.

- [ ] **Step 5: Run final automated verification**

```bash
cd web
npm test
npm run typecheck
npm run build
```

Expected: all pass.

- [ ] **Step 6: Run Supabase security and performance advisors again**

Resolve material warnings introduced by the completed app before production cutover.

- [ ] **Step 7: Document rollback and cutover**

The checklist must state that the Apps Script deployment remains available as temporary rollback and that the migration branch is merged to `main` only after preview verification succeeds.

- [ ] **Step 8: Commit**

```bash
git add web/README.md docs/migration/neramit-cutover-checklist.md
git commit -m "docs: add Neramit deployment and cutover guide"
```

---

## Final verification gate

Before merging `migration/vercel-supabase` into `main`, verify all of the following:

```bash
cd web
npm test
npm run typecheck
npm run build
```

Also verify:
- Supabase security advisor has no unresolved material security issue.
- Supabase performance advisor has no unresolved critical issue.
- Private reference files cannot be fetched without ownership validation.
- A duplicate `requestId` cannot consume quota twice.
- A suspended device cannot generate.
- Admin routes reject device tokens as admin credentials.
- `OPENAI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are absent from client bundles and Git history.
- Existing `neramit_device_token_v1` browser tokens continue to be reused.
- Vercel preview passes the complete user flow on mobile and desktop.
