# Member Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first production-ready member foundation: Supabase email/password auth, immutable username onboarding, private profile, avatar upload, member shell/dashboard, email/password account actions, and server-side member guards that later credit/plan phases can reuse.

**Architecture:** Supabase Auth remains the identity/session authority. Neramit adds RLS-protected profile data and private Storage for member avatars, plus small server helpers that validate bearer tokens and load member state. This phase intentionally does not implement credits, Pro billing, payment slips, moderation, or AI charging; those are separate plans that build on the stable `user_id` and member guard introduced here.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5.9 strict, Supabase JS 2.57, Zod 3, Vitest 3, Supabase Postgres/RLS/Storage

**Spec:** `docs/superpowers/specs/2026-09-19-member-platform-design.md`

## Global Constraints

- Auth method in v1 is Email + Password only.
- Signup is immediately usable; mandatory email verification is not part of the product flow.
- Username is unique and immutable after onboarding.
- Member profile is private.
- Editable profile fields are display name and avatar only.
- Avatar accepts JPG, PNG, WebP and is limited to 2 MB.
- No public profile/community in v1.
- Existing owner-only Admin authentication must remain independent and unchanged.
- Every protected member API must resolve the authenticated user server-side; never trust a user id sent by the client.
- Member tables use RLS.
- Do not expose service-role credentials to the client.
- This phase must pass `npm test`, `npm run typecheck`, and `npm run build` before merge.

---

## File Structure

### New database / auth files
- `supabase/migrations/202609190010_member_core.sql` — profile schema, username constraints, onboarding trigger/function, RLS, avatar bucket policies.
- `lib/supabase/browser.ts` — browser Supabase client using publishable/anon key.
- `lib/member/auth.ts` — server bearer-token validation and member context.
- `lib/member/profile.ts` — shared profile validation/types.

### New routes
- `app/api/member/profile/route.ts` — authenticated profile GET/PATCH.
- `app/api/member/avatar/route.ts` — authenticated avatar upload/delete.
- `app/api/member/password/route.ts` — authenticated password change and global sign-out behavior.
- `app/api/member/email/route.ts` — password-confirmed email change request.
- `app/api/member/delete-request/route.ts` — create/cancel 7-day deletion request state only; final cleanup comes later.

### New pages/components
- `app/login/page.tsx`
- `app/signup/page.tsx`
- `app/forgot-password/page.tsx`
- `app/reset-password/page.tsx`
- `app/onboarding/page.tsx`
- `app/account/layout.tsx`
- `app/account/page.tsx`
- `app/account/profile/page.tsx`
- `app/account/security/page.tsx`
- `components/member/AuthForm.tsx`
- `components/member/OnboardingForm.tsx`
- `components/member/MemberShell.tsx`
- `components/member/ProfileForm.tsx`
- `components/member/SecurityForm.tsx`

### Existing files modified
- `app/layout.tsx` — no auth logic; only metadata additions if needed.
- `app/globals.css` — member/auth responsive UI classes.
- `components/HomeClient.tsx` — add member login/account entry point without changing existing core workflow.
- `.env.example` — add browser-safe Supabase key variable if missing.

### Tests
- `tests/member-profile.test.ts`
- `tests/member-auth.test.ts`
- `tests/member-route-validation.test.ts`

---

### Task 1: Member schema, username rules, and RLS

**Files:**
- Create: `supabase/migrations/202609190010_member_core.sql`
- Test: verified via Supabase migration + SQL assertions

**Interfaces:**
- Produces: `profiles(user_id, username, display_name, avatar_path, onboarding_completed, deletion_requested_at, created_at, updated_at)`
- Produces: function `public.create_member_profile(p_username text, p_display_name text)`
- Produces: private Storage bucket `member-avatars`

- [ ] **Step 1: Write migration with constrained profile schema**

Use:
```sql
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_path text,
  onboarding_completed boolean not null default false,
  deletion_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (
    username is null or username ~ '^[a-z0-9_]{3,24}$'
  ),
  constraint profiles_display_name_length check (
    display_name is null or char_length(display_name) between 1 and 80
  )
);
```

- [ ] **Step 2: Add signup trigger that creates only the empty profile shell**

```sql
create or replace function public.handle_new_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_member on auth.users;
create trigger on_auth_user_created_member
after insert on auth.users
for each row execute function public.handle_new_member();
```

- [ ] **Step 3: Add atomic immutable-username onboarding function**

The function must:
- normalize username with `lower(trim(...))`
- reject a second username assignment
- reject duplicate username
- set display name
- set `onboarding_completed=true`
- only operate for `auth.uid()`

Core body:
```sql
create or replace function public.create_member_profile(
  p_username text,
  p_display_name text
) returns public.profiles
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_username text := lower(trim(p_username));
  v_display_name text := trim(p_display_name);
begin
  if v_username !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'USERNAME_INVALID';
  end if;
  if char_length(v_display_name) < 1 or char_length(v_display_name) > 80 then
    raise exception 'DISPLAY_NAME_INVALID';
  end if;

  select * into v_profile
  from public.profiles
  where user_id = auth.uid()
  for update;

  if v_profile.user_id is null then
    raise exception 'PROFILE_NOT_FOUND';
  end if;
  if v_profile.username is not null then
    raise exception 'USERNAME_IMMUTABLE';
  end if;

  update public.profiles
  set username = v_username,
      display_name = v_display_name,
      onboarding_completed = true,
      updated_at = now()
  where user_id = auth.uid()
  returning * into v_profile;

  return v_profile;
exception
  when unique_violation then
    raise exception 'USERNAME_TAKEN';
end;
$$;
```

- [ ] **Step 4: Enable RLS and add member self-read/update policies**

Policy rules:
- `select`: `auth.uid() = user_id`
- direct `update`: only self row, but username immutability must also be enforced by a trigger so a crafted client cannot change it
- no member delete policy

Create a `before update` trigger that raises `USERNAME_IMMUTABLE` when old username is non-null and new username differs.

- [ ] **Step 5: Create private avatar bucket and object policies**

Create `member-avatars` as private. Object path convention:
`<auth.uid()>/avatar.<ext>`

Policies:
- authenticated user can select/insert/update/delete only objects whose first folder equals `auth.uid()::text`.
- enforce MIME type in the API as well as bucket restrictions.

- [ ] **Step 6: Apply migration on a development/branch database and verify**

Run SQL assertions:
```sql
select column_name
from information_schema.columns
where table_schema='public' and table_name='profiles'
order by ordinal_position;
```

Expected: the profile columns above are present.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/202609190010_member_core.sql
git commit -m "feat: add member core schema"
```

---

### Task 2: Browser Supabase client and shared profile validation

**Files:**
- Create: `lib/supabase/browser.ts`
- Create: `lib/member/profile.ts`
- Create: `tests/member-profile.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `getBrowserSupabase(): SupabaseClient`
- Produces: `usernameSchema`
- Produces: `displayNameSchema`
- Produces: `normalizeUsername(value: string): string`

- [ ] **Step 1: Write failing profile validation tests**

```ts
import { describe, expect, it } from 'vitest';
import { normalizeUsername, usernameSchema } from '@/lib/member/profile';

describe('member profile validation', () => {
  it('normalizes usernames to lowercase', () => {
    expect(normalizeUsername('  Chanakan_67 ')).toBe('chanakan_67');
  });

  it('accepts 3-24 lowercase letters numbers underscores', () => {
    expect(usernameSchema.safeParse('chanakan_67').success).toBe(true);
  });

  it('rejects spaces and symbols', () => {
    expect(usernameSchema.safeParse('chan akan!').success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run: `npm test -- tests/member-profile.test.ts`  
Expected: FAIL because `@/lib/member/profile` does not exist.

- [ ] **Step 3: Implement validation**

```ts
import { z } from 'zod';

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,24}$/);

export const displayNameSchema = z.string().trim().min(1).max(80);

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}
```

- [ ] **Step 4: Add browser client**

```ts
import { createClient } from '@supabase/supabase-js';

let client: ReturnType<typeof createClient> | null = null;

export function getBrowserSupabase() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase browser configuration is missing');
  client = createClient(url, key);
  return client;
}
```

Add `NEXT_PUBLIC_SUPABASE_ANON_KEY=` to `.env.example` if not already present. Never expose the service-role key.

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/member-profile.test.ts`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/supabase/browser.ts lib/member/profile.ts tests/member-profile.test.ts .env.example
git commit -m "feat: add member browser auth foundation"
```

---

### Task 3: Server member authentication guard

**Files:**
- Create: `lib/member/auth.ts`
- Create: `tests/member-auth.test.ts`

**Interfaces:**
- Produces:
```ts
export type MemberContext = {
  userId: string;
  email: string | null;
  accessToken: string;
};

export async function requireMember(req: Request): Promise<MemberContext>;
```

- [ ] **Step 1: Write token parser tests**

Tests cover:
- missing Authorization -> `MEMBER_REQUIRED`
- non-Bearer -> `MEMBER_REQUIRED`
- bearer token extraction

Keep pure parsing in an exported `getBearerToken(req)` helper so it can be tested without network calls.

- [ ] **Step 2: Implement `getBearerToken`**

```ts
export function getBearerToken(req: Request) {
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) throw new Error('MEMBER_REQUIRED');
  const token = header.slice(7).trim();
  if (!token) throw new Error('MEMBER_REQUIRED');
  return token;
}
```

- [ ] **Step 3: Implement `requireMember` with Supabase Auth**

Use the existing server configuration URL but validate the user from the bearer token rather than trusting body params:
```ts
import { createClient } from '@supabase/supabase-js';

export async function requireMember(req: Request): Promise<MemberContext> {
  const accessToken = getBearerToken(req);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Supabase member configuration is missing');

  const authClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data, error } = await authClient.auth.getUser(accessToken);
  if (error || !data.user) throw new Error('MEMBER_SESSION_EXPIRED');

  return {
    userId: data.user.id,
    email: data.user.email ?? null,
    accessToken
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/member-auth.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/member/auth.ts tests/member-auth.test.ts
git commit -m "feat: add member auth guard"
```

---

### Task 4: Signup, login, password reset screens

**Files:**
- Create: `components/member/AuthForm.tsx`
- Create: `app/login/page.tsx`
- Create: `app/signup/page.tsx`
- Create: `app/forgot-password/page.tsx`
- Create: `app/reset-password/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Signup success -> `/onboarding`
- Login success -> if profile onboarding complete then `/account`, otherwise `/onboarding`
- Reset recovery -> `/reset-password`

- [ ] **Step 1: Implement shared AuthForm**

Required form states:
- idle
- submitting
- field/server error
- success where applicable

Signup call:
```ts
await supabase.auth.signUp({ email, password });
```

Login call:
```ts
await supabase.auth.signInWithPassword({ email, password });
```

Forgot password:
```ts
await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${location.origin}/reset-password`
});
```

- [ ] **Step 2: Implement reset-password page**

On valid recovery session:
```ts
await supabase.auth.updateUser({ password: newPassword });
await supabase.auth.signOut({ scope: 'global' });
```

Then redirect to `/login?password=changed`.

- [ ] **Step 3: Add responsive auth styling**

Reuse existing variables `--gradient`, `--line`, `--shadow`, `--ink`; do not create a separate visual system.

- [ ] **Step 4: Manually verify**

Verify:
- invalid email
- wrong password
- duplicate email
- forgot-password success message
- reset form password mismatch
- mobile width 390px

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/member/AuthForm.tsx app/login app/signup app/forgot-password app/reset-password app/globals.css
git commit -m "feat: add member authentication screens"
```

---

### Task 5: Onboarding and immutable username

**Files:**
- Create: `components/member/OnboardingForm.tsx`
- Create: `app/onboarding/page.tsx`
- Create: `app/api/member/profile/route.ts`
- Create: `tests/member-route-validation.test.ts`

**Interfaces:**
- `POST /api/member/profile` creates the username/display name exactly once through `create_member_profile`.
- `GET /api/member/profile` returns only the current member profile.
- `PATCH /api/member/profile` updates display name only in this phase.

- [ ] **Step 1: Write route-body validation tests**

Use exported Zod schemas for:
```ts
{ username: string, displayName: string }
```
and:
```ts
{ displayName: string }
```

Test invalid username, empty display name, and unknown keys if strict mode is used.

- [ ] **Step 2: Implement authenticated profile route**

Every handler calls `requireMember(req)`.  
Never accept `userId` from request JSON.

For POST, call RPC with the member bearer token through a user-scoped Supabase client so `auth.uid()` and RLS are effective.

- [ ] **Step 3: Implement OnboardingForm**

Flow:
1. Display name
2. Username
3. Optional avatar upload
4. Submit profile
5. Redirect `/account`

If `USERNAME_TAKEN`, keep the form values and show inline error.

- [ ] **Step 4: Verify username immutability**

After onboarding, a direct profile PATCH containing `username` must return 400 and database-level direct update must also fail.

- [ ] **Step 5: Run tests/typecheck**

Run:
```bash
npm test -- tests/member-route-validation.test.ts
npm run typecheck
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/member/OnboardingForm.tsx app/onboarding app/api/member/profile tests/member-route-validation.test.ts
git commit -m "feat: add member onboarding"
```

---

### Task 6: Private avatar upload

**Files:**
- Create: `app/api/member/avatar/route.ts`
- Modify: `components/member/OnboardingForm.tsx`
- Create/Modify: `components/member/ProfileForm.tsx`
- Test: `tests/member-route-validation.test.ts`

**Interfaces:**
- `POST /api/member/avatar` multipart field `avatar`
- `DELETE /api/member/avatar`

- [ ] **Step 1: Add pure avatar validation helper**

Validate:
- size <= `2 * 1024 * 1024`
- MIME one of `image/jpeg`, `image/png`, `image/webp`
- extension generated by server from MIME, never trusted from filename

- [ ] **Step 2: Add failing validation tests**

Test 2MB boundary, too-large file, and disallowed GIF/PDF.

- [ ] **Step 3: Implement upload route**

Path:
```ts
`${member.userId}/avatar.${extension}`
```

Use server/service role only for controlled storage mutation after `requireMember`; update only the authenticated member's `avatar_path`.

- [ ] **Step 4: Return signed URL, not public URL**

Because bucket is private, create a short-lived signed URL for immediate display. Persistent DB value remains the object path.

- [ ] **Step 5: Run tests/typecheck**

Run:
```bash
npm test -- tests/member-route-validation.test.ts
npm run typecheck
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/member/avatar components/member tests/member-route-validation.test.ts
git commit -m "feat: add private member avatars"
```

---

### Task 7: Member shell, Dashboard, and Profile page

**Files:**
- Create: `components/member/MemberShell.tsx`
- Create: `components/member/ProfileForm.tsx`
- Create: `app/account/layout.tsx`
- Create: `app/account/page.tsx`
- Create: `app/account/profile/page.tsx`
- Modify: `app/globals.css`
- Modify: `components/HomeClient.tsx`

**Interfaces:**
- Account shell contains links reserved for later phases: Dashboard, My Creations, Plans & Credits, Orders, Notifications, Profile, Security.
- Phase 1 links without implemented pages may be visually disabled or route to a clear `coming soon` state; do not create fake data.

- [ ] **Step 1: Build MemberShell**

Requirements:
- responsive sidebar/top nav
- current member avatar/display name/username
- logout action
- member navigation

- [ ] **Step 2: Build simple dashboard**

Phase 1 only has real profile data, so render:
- plan placeholder label only if it comes from an explicit server fallback `Free`; do not fabricate credits yet
- recent creations section must state that no creation history integration is available until Phase 5
- no fake numbers

- [ ] **Step 3: Build Profile page**

Editable:
- display name
- avatar

Read-only:
- username
- email

- [ ] **Step 4: Add home entry point**

When unauthenticated show `เข้าสู่ระบบ`.  
When authenticated show `บัญชีของฉัน`.

Do not break existing home/AI workflow.

- [ ] **Step 5: Responsive verification**

Check desktop, tablet, and 390px width. Ensure no horizontal overflow.

- [ ] **Step 6: Run typecheck/build**

Run:
```bash
npm run typecheck
npm run build
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/member app/account app/globals.css components/HomeClient.tsx
git commit -m "feat: add member account shell"
```

---

### Task 8: Security page, email change, password change, deletion grace state

**Files:**
- Create: `components/member/SecurityForm.tsx`
- Create: `app/account/security/page.tsx`
- Create: `app/api/member/password/route.ts`
- Create: `app/api/member/email/route.ts`
- Create: `app/api/member/delete-request/route.ts`
- Modify: `tests/member-route-validation.test.ts`

**Interfaces:**
- `POST /api/member/password` confirms current password, changes password, then globally signs out.
- `POST /api/member/email` confirms password then requests/updates email according to Supabase Auth behavior.
- `POST /api/member/delete-request` sets `deletion_requested_at=now()`.
- `DELETE /api/member/delete-request` clears it during grace period.

- [ ] **Step 1: Add validation tests**

Password change body:
```ts
{ currentPassword: string, newPassword: string }
```

Email change body:
```ts
{ password: string, email: string }
```

Reject weak/empty input before auth calls.

- [ ] **Step 2: Implement password confirmation helper**

Use current member email and a temporary browser/user-scoped auth client:
```ts
await client.auth.signInWithPassword({
  email: member.email!,
  password: currentPassword
});
```

Only proceed if confirmation succeeds.

- [ ] **Step 3: Implement password change + global revocation**

After successful update:
```ts
await client.auth.signOut({ scope: 'global' });
```

Return a response instructing frontend to clear local state and route to login.

- [ ] **Step 4: Implement email change**

Require password confirmation first. Do not bypass Supabase's configured auth security behavior. Return whether the change is immediate or awaiting confirmation based on the Auth response.

- [ ] **Step 5: Implement deletion request state**

This phase only sets/cancels the timestamp. It does **not** physically delete Auth, profile, or storage data. Final cleanup job belongs to the Moderation & Notifications phase.

- [ ] **Step 6: Build Security page**

Sections:
- Email
- Change password
- Delete account
- Active Sessions placeholder explaining session management arrives in the later security/session phase; do not fake device rows

- [ ] **Step 7: Run tests/typecheck/build**

Run:
```bash
npm test
npm run typecheck
npm run build
```
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add components/member/SecurityForm.tsx app/account/security app/api/member/password app/api/member/email app/api/member/delete-request tests/member-route-validation.test.ts
git commit -m "feat: add member account security"
```

---

### Task 9: Phase-1 integration verification

**Files:**
- No new product files unless verification finds a defect.
- Update: `docs/superpowers/specs/2026-09-19-member-platform-design.md` only if implementation reveals a design correction requiring explicit documentation.

**Interfaces:**
- Confirms the Member Core contract for later phases.

- [ ] **Step 1: Run full automated checks**

```bash
npm test
npm run typecheck
npm run build
```

Expected: all PASS.

- [ ] **Step 2: Smoke-test auth flow**

Verify:
- signup -> onboarding
- immutable username
- login/logout
- forgot/reset password
- account dashboard
- edit display name
- upload/delete avatar
- password change -> all sessions invalidated as supported by Supabase global sign-out
- request/cancel account deletion

- [ ] **Step 3: Security checks**

Verify:
- no service-role key reaches client bundle
- profile APIs ignore/reject caller-supplied user ids
- one account cannot read another profile through RLS
- one account cannot write another avatar folder
- username update after onboarding fails at DB level

- [ ] **Step 4: Commit verification fixes if any**

Use a focused commit message describing the defect fixed.

- [ ] **Step 5: Open Phase-1 PR**

PR title:
```
feat: member core authentication and profiles
```

PR body must link the design spec and this plan, list migrations, and include actual test/typecheck/build results.

