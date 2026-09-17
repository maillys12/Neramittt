# Neramit Vercel + Supabase Migration Design

**Date:** 2026-09-17

## Goal

Migrate Neramit from Google Apps Script, Google Sheets, and Google Drive to a production web architecture using GitHub, Vercel, and Supabase while preserving the current product flow, visual direction, device-based no-login usage model, prompt-generation behavior, history, quota, reference images, and admin capabilities.

The migration starts with a fresh Supabase database. Existing Google Sheets data will not be migrated.

## Repository and deployment

- Source repository: `maillys12/Neramittt`
- Migration branch: `migration/vercel-supabase`
- Production branch remains `main` until the migrated app is verified.
- Hosting and server runtime: Vercel
- Database and object storage: Supabase
- AI provider: OpenAI, called only from server-side code
- Supabase project: new project named `Neramit`
- Supabase region: `ap-southeast-1` (Singapore)

## Application architecture

The migrated application will use Next.js with TypeScript so the frontend and server API can live in one deployable Vercel project.

```text
Browser
  |
  v
Next.js on Vercel
  |- UI routes
  |- Server route handlers
  |- Device validation
  |- Quota enforcement
  |- Admin authentication
  |- OpenAI calls
  |
  v
Supabase
  |- PostgreSQL
  |- Private Storage
```

No production feature will depend on Google Apps Script, Google Sheets, or Google Drive after migration.

## User identity model

Neramit remains registration-free.

- The browser keeps a stable anonymous device token.
- The existing localStorage key `neramit_device_token_v1` is preserved for continuity.
- A new device record is created in Supabase on first use when necessary.
- History, drafts, usage, and quota are associated with the device ID.
- Device suspension is enforced server-side.
- Device tokens are treated as bearer credentials and must never grant admin privileges.

## Main product flow

The current product structure remains:

1. Home
2. AI Chat or Quick Form
3. Optional reference images
4. Review
5. Prompt generation
6. Result
7. History
8. Admin

The visual design and interaction flow already created for the Apps Script SPA should be reproduced, but page navigation and local UI state must be handled in the browser without server round trips.

## Performance rules

The migration is intended to remove the latency caused by `google.script.run` and repeated spreadsheet operations.

- Navigation, tab changes, form edits, modal state, selections, and animations are client-side only.
- Draft edits are debounced before persistence.
- Data is fetched only when a screen needs it.
- History is paginated.
- Admin tables are paginated and filtered server-side.
- Reference image previews are served from Supabase Storage.
- AI calls, quota reservation, sensitive validation, and admin actions remain server-side.

## Database schema

### `devices`

Stores anonymous clients and suspension state.

Fields:
- `id uuid primary key`
- `device_token_hash text unique not null`
- `status text not null default 'active'`
- `created_at timestamptz not null default now()`
- `last_seen_at timestamptz not null default now()`

Allowed status values: `active`, `suspended`.

### `drafts`

Stores the creative brief for both Chat and Quick Form flows.

Fields:
- `id uuid primary key`
- `device_id uuid not null references devices(id)`
- `mode text not null`
- `state text not null`
- `title text`
- `brief jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `expires_at timestamptz`

Allowed mode values: `chat`, `form`.

### `chat_messages`

Fields:
- `id uuid primary key`
- `draft_id uuid not null references drafts(id) on delete cascade`
- `role text not null`
- `content text not null`
- `created_at timestamptz not null default now()`

Allowed roles: `user`, `assistant`, `system`.

### `reference_images`

Fields:
- `id uuid primary key`
- `draft_id uuid not null references drafts(id) on delete cascade`
- `device_id uuid not null references devices(id)`
- `storage_path text not null unique`
- `mime_type text not null`
- `size_bytes bigint not null`
- `analysis jsonb`
- `usage_options jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `expires_at timestamptz`

Maximum reference count per draft remains 4.

### `prompt_jobs`

Stores generation requests and idempotency state.

Fields:
- `id uuid primary key`
- `request_id text unique not null`
- `draft_id uuid not null references drafts(id)`
- `device_id uuid not null references devices(id)`
- `status text not null`
- `variant_count integer not null`
- `result jsonb`
- `error_message text`
- `created_at timestamptz not null default now()`
- `completed_at timestamptz`

Allowed status values: `queued`, `processing`, `completed`, `failed`.

### `prompts`

Stores completed prompt output for history.

Fields:
- `id uuid primary key`
- `device_id uuid not null references devices(id)`
- `draft_id uuid references drafts(id)`
- `prompt_job_id uuid references prompt_jobs(id)`
- `title text`
- `input_summary jsonb not null default '{}'::jsonb`
- `variants jsonb not null`
- `created_at timestamptz not null default now()`
- `deleted_at timestamptz`

### `daily_usage`

Fields:
- `device_id uuid not null references devices(id)`
- `usage_date date not null`
- `used_count integer not null default 0`
- `reserved_count integer not null default 0`
- `primary key (device_id, usage_date)`

Quota reservation and consumption must be atomic so double-clicking or retrying the same request cannot consume quota twice.

### `settings`

Fields:
- `key text primary key`
- `value jsonb not null`
- `updated_at timestamptz not null default now()`

Initial application settings include:
- daily quota
- maximum reference images
- maximum upload size
- reference retention days
- draft retention days
- admin session duration
- chat message limit

### `admin_sessions`

Fields:
- `id uuid primary key`
- `token_hash text unique not null`
- `expires_at timestamptz not null`
- `created_at timestamptz not null default now()`
- `last_seen_at timestamptz`

### `admin_audit_logs`

Fields:
- `id bigint generated always as identity primary key`
- `action text not null`
- `target_type text`
- `target_id text`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

### `error_logs`

Fields:
- `id bigint generated always as identity primary key`
- `source text not null`
- `message text not null`
- `details jsonb`
- `created_at timestamptz not null default now()`

## Supabase Storage

Create a private bucket named `reference-images`.

Rules:
- Files are uploaded through server-authorized flows.
- Files are stored under a draft/device namespace.
- Only authorized server routes can generate access URLs.
- Files are deleted when the user removes a reference or when retention cleanup expires it.
- Supported formats: JPEG, PNG, WebP.

## Server API boundaries

The browser must never receive privileged Supabase credentials or the OpenAI API key.

The application will expose server routes for these responsibilities:

- device initialization and quota status
- draft create/read/update
- chat send/read
- reference upload/analyze/update/remove
- review data
- prompt generation and job status
- history list/detail/clone/delete
- admin login/logout/dashboard/settings/device controls/reference deletion

Routes validate the device token and resource ownership before reading or modifying user data.

## OpenAI behavior

Existing product behavior is preserved:

- Chat asks only for important missing information.
- Chat does not repeatedly ask questions already answered.
- Chat must not invent user facts.
- Reference analysis returns colors, style, composition, subjects, background, visible text, and confidence notes.
- Users choose which analyzed reference aspects are used.
- Exact poster text supplied by the user must be preserved when requested.
- Prompt generation supports 1 to 3 variants.
- Server-side idempotency prevents duplicate generation for the same request ID.

## Quota model

Quota is enforced on the server.

Generation flow:

1. Validate device and draft ownership.
2. Check device status.
3. Begin a database transaction or atomic database function.
4. Reserve one quota unit for the request ID.
5. Generate the prompt.
6. Convert the reservation into consumed usage on success.
7. Release reservation on terminal failure.

Repeated calls using the same request ID return the existing job rather than consuming additional quota.

## Admin security

Admin authentication remains separate from device authentication.

- Admin password is stored only as a salted password hash.
- Admin login returns a random session token.
- Only a hash of the session token is stored in Supabase.
- Sessions expire based on a setting.
- Failed login attempts are rate-limited.
- Admin actions are recorded in `admin_audit_logs`.
- Admin routes are server-only and must never trust client-supplied privilege flags.

## Supabase access policy

The browser does not directly perform privileged table mutations.

Use Row Level Security on all user-data tables. The preferred production design is for sensitive writes and ownership checks to occur through Vercel server routes using server credentials, while client-visible Supabase credentials are limited to operations that are explicitly safe under RLS.

After schema creation, Supabase security and performance advisors must be checked and material issues fixed before production cutover.

## Frontend structure

Target structure:

```text
app/
  page.tsx
  chat/
  form/
  references/
  review/
  result/
  history/
  admin/
  api/
components/
  ui/
  layout/
  prompt/
lib/
  device/
  supabase/
  openai/
  quota/
  admin/
  validation/
types/
```

The frontend will preserve the Neramit branding, responsive layout, Thai-first copy, SVG branding assets, gradients, cards, animations, and reduced-motion behavior from the current SPA.

## Error handling

- User-facing API failures show concise Thai error messages.
- Internal error details are logged to `error_logs` without exposing secrets.
- Network retries must not create duplicate generation jobs.
- Invalid or expired admin sessions return an authentication error and clear local admin state.
- Suspended devices cannot generate new prompts.
- Failed image analysis does not delete the uploaded image; the user may retry or remove it.

## Retention and cleanup

A scheduled Vercel cron route will clean expired drafts and reference images.

Cleanup behavior:
- delete expired draft-related data according to configured retention
- delete associated objects from Supabase Storage
- retain completed prompt history unless the user deletes it
- keep admin audit logs and error logs independently of draft retention

## Testing strategy

Automated tests must cover:

- device token creation and continuity
- device ownership enforcement
- quota reservation and idempotency
- duplicate generation requests
- draft create/update/review flow
- chat state updates
- reference upload constraints
- reference ownership and deletion
- history pagination and soft delete
- admin session expiry
- suspended device behavior
- server route validation

Before production cutover:

- run TypeScript checks
- run unit/integration tests
- run production build
- run Supabase security advisor
- run Supabase performance advisor
- deploy a Vercel preview
- verify the complete user flow on mobile and desktop

## Migration and cutover

There is no historical data migration.

Cutover sequence:

1. Build the new application on `migration/vercel-supabase`.
2. Create and configure the new Supabase `Neramit` project.
3. Configure Vercel environment variables.
4. Deploy a Vercel preview.
5. Verify Home -> Chat/Form -> References -> Review -> Result -> History and Admin.
6. Merge the migration branch only after verification.
7. Point the production domain to the Vercel project.
8. Keep the Apps Script deployment available temporarily as rollback until the new system is stable.

## Environment variables

Server-only:
- `OPENAI_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_PASSWORD_HASH` or an equivalent server-side bootstrap secret during initial admin setup

Public/client-safe:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

No server secret may be committed to GitHub.

## Out of scope for this migration

To keep the first migration simple:

- no user registration or Google login
- no billing system
- no migration of existing Google Sheets rows
- no migration of Google Drive reference files
- no major redesign of the approved Neramit UI
- no unrelated features beyond the existing Neramit product scope

## Success criteria

The migration is complete when:

- Neramit runs from Vercel without Google Apps Script runtime dependencies.
- All persistent application data is stored in Supabase.
- Reference files are stored in private Supabase Storage.
- OpenAI secrets are server-only.
- The current no-login device-based flow still works.
- Quota cannot be double-consumed by retries or duplicate requests.
- History, references, Chat, Quick Form, result, and Admin flows work end to end.
- Normal UI interactions no longer wait on backend calls unless data or AI processing is genuinely required.
- Production build and automated tests pass before the branch is merged to `main`.
