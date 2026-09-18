# Neramit Member Platform Design

**Date:** 2026-09-19  
**Status:** Approved design, implementation pending written-spec review  
**Branch:** `feature/member-platform`

## 1. Goal

Build a first-party membership platform for Neramit on top of Supabase Auth. Supabase handles authentication primitives; Neramit owns profile, plan, credits, billing, moderation, notifications, sessions UI, and member-facing work history.

## 2. Chosen architecture

Use **Supabase Auth + custom membership layer**.

- Supabase Auth owns email/password signup, login, password reset, auth sessions, and user identity.
- `auth.users.id` is the canonical user id.
- Business data stays in public/app tables with RLS, not in `auth.users`.
- Server-side APIs are authoritative for plan, credits, permissions, payment approval, suspension, and AI access.
- Frontend never decides whether a user may call AI.
- Existing owner-only Admin remains separate from member auth.

## 3. Authentication and onboarding

### Signup/login
- Email + password only.
- No email verification requirement before first use.
- New users can use Neramit immediately after signup.
- On first signup, grant the current Free monthly credit allocation immediately.

### Onboarding
Short onboarding:
1. Display name
2. Unique username
3. Optional profile image

Username:
- Unique, case-normalized for collision checks.
- Immutable after first successful creation.
- No public member profile in v1.

Profile:
- Display name editable.
- Avatar editable.
- Avatar types: JPG, PNG, WebP.
- Max avatar upload size: 2 MB.
- Default avatar used when none uploaded.

Email:
- Can be changed only after password confirmation.

Password:
- Change password.
- Forgot/reset password through email.
- Changing password invalidates all active member sessions.

## 4. Member area

Primary navigation:
- Dashboard
- My Creations
- Plans & Credits
- Orders
- Notifications
- Profile
- Security

Dashboard stays intentionally simple:
- Current total credits
- Current plan: Free/Pro
- Pro expiry when applicable
- Recent creations

## 5. Creations

- Save creations/conversations automatically.
- Unlimited history for both Free and Pro in v1.
- User can rename, pin, and delete creations.
- Opening an old creation can continue the conversation with prior context.
- No public sharing/community in v1.

## 6. Plans and AI entitlements

Plans:
- Free
- Pro Monthly
- Pro Yearly

Free and Pro differ in:
- Credit allocation
- Available AI model tier
- Reasoning depth
- Research capability/stage access

Actual provider model names are not shown to users.

Plan configuration must be Admin-editable:
- Normal price
- Monthly credit allocation
- Duration
- Sale availability
- AI entitlement profile

Pro renewal:
- Buying Pro again before expiry extends from the current expiry.
- Monthly <-> yearly changes take effect after the existing plan expires.
- During a pending renewal after Pro has already expired, the user receives Free rights until approval.
- Pro expiry clears the current Pro monthly credit balance and returns the account to Free.
- Purchased credits remain.

Pro suspension:
- Subscription time pauses while the account is suspended.
- Resume preserves the remaining Pro duration.

## 7. Credits

Two balances:
- `monthly_credits`
- `purchased_credits`

Rules:
- Monthly credits reset on the 1st of every month.
- Monthly credits do not roll over.
- Purchased credits do not expire.
- Spend monthly credits before purchased credits.
- New Free members receive the Free monthly allocation immediately.
- Upgrading to Pro mid-month grants the full Pro monthly allocation immediately.
- Pro Yearly still receives monthly credits on the 1st, not the full annual amount up front.
- When Pro expires, the Pro monthly credit balance is cleared.

User visibility:
- Show current credit balances/numbers.
- Do not show per-request credit usage.
- Do not show member credit movement history in v1.

Charging:
- Credits are derived from actual internal AI cost, not fixed per action.
- Admin can change the AI-cost-to-credit conversion rate.
- A new conversion rate applies to future usage only; existing balances are not rewritten.
- If credits are exhausted, block new AI use immediately.
- Admin compensation/refunds are manual credit adjustments with an audit reason.

The backend retains a credit ledger even though members do not see it.

## 8. Payments and orders

Payment method:
- PromptPay + slip upload.
- Admin manually reviews all slips.
- No automatic slip validation in v1.

PromptPay modes:
- Static uploaded QR.
- Dynamic amount QR generated from the final order amount.
- Admin selects the active mode.

Checkout:
- User chooses plan/credit pack.
- No extra transfer-name/time fields.
- User uploads slip and submits.
- Order statuses: pending review, approved, rejected, cancelled.
- User may cancel before approval.
- Cancelled orders remain in history.
- Rejected orders may accept a new slip on the same order and return to pending review.

Approval:
- Default Pro start time is the Admin approval time.
- Admin may override the Pro start date.
- Expiry is calculated from the approved start date and plan duration.

Order history:
- Show all member orders.
- Show date, item, amount, status, and uploaded slip.

## 9. Promotions

Admin can configure time-based promotions:
- Normal price
- Promotional price
- Start time
- End time
- Enabled/disabled

Member pricing UI shows:
- Struck normal price
- Current promotional price
- Percentage discount

No coupon/referral system in v1.

## 10. Notifications

Channels:
- In-app Notification Center
- Email

Events include:
- Payment approved/rejected
- Pro activated
- Credit low
- Credit exhausted
- Pro expiry reminders
- Suspension
- Appeal result

Thresholds:
- Credit warnings at 20% and 5%.
- Pro expiry reminders at 7 days and 1 day.

No new-device login alert in v1.

## 11. Sessions and security

- Multiple simultaneous devices are allowed.
- Security page shows active sessions/devices.
- User can revoke one session.
- User can revoke all sessions.
- Password change revokes all sessions automatically.
- Device UI should show only minimal metadata such as browser/device class, current session, and last active time.
- Do not expose precise location.

## 12. Account deletion

- Deletion request starts a 7-day grace period.
- During grace period, user can cancel deletion.
- Physical cleanup happens only after the grace period.
- Cleanup must be idempotent and auditable.

## 13. Suspension and appeals

Suspended member:
- Cannot access normal product functionality.
- Lands on a suspension screen only.
- Can submit an appeal from that screen.

Appeals:
- Admin reviews manually.
- States: pending, approved, rejected.
- If rejected, the user can appeal again after 7 days.
- Suspension, unsuspension, appeal decisions, and important changes are audited.

## 14. Admin Member Management

Admin can:
- Search members
- View Free/Pro state
- View monthly/purchased balances
- View Pro dates
- View order/payment history
- Add/remove credits
- Move Free <-> Pro
- Edit subscription start/end values
- Suspend/unsuspend
- Review appeals
- Edit plans
- Edit credit packs
- Edit promotions
- Configure PromptPay mode/settings

Username remains immutable through normal Admin UI.

All important mutations require audit logs with actor, action, target, before/after where relevant, reason when applicable, and timestamp.

## 15. Proposed data model

Core tables:
- `profiles`
- `member_subscriptions`
- `credit_wallets`
- `credit_ledger`
- `plans`
- `credit_packs`
- `orders`
- `payment_submissions`
- `promotions`
- `member_notifications`
- `member_session_metadata`
- `suspensions`
- `appeals`
- `creations`
- `member_audit_logs`

### profiles
One row per `auth.users.id`.
Important columns:
- user_id uuid PK/FK
- username text unique
- display_name text
- avatar_path text nullable
- onboarding_completed boolean
- deletion_requested_at timestamptz nullable
- created_at / updated_at

### member_subscriptions
Represents current entitlement state plus pending next plan.
Important columns:
- user_id
- plan_code
- billing_interval
- status
- starts_at
- ends_at
- paused_at
- paused_remaining_seconds
- next_plan_code nullable
- next_billing_interval nullable

### credit_wallets
Fast current balance:
- user_id
- monthly_balance numeric
- purchased_balance numeric
- monthly_allocation numeric
- monthly_reset_month date
- updated_at

### credit_ledger
Append-only monetary/credit audit:
- id
- user_id
- wallet_type
- direction
- amount
- reason_code
- source_type
- source_id
- metadata
- created_at

Balance mutations should be performed through database functions/transactions rather than independent frontend writes.

### plans / credit_packs / promotions
Server-managed catalog. RLS allows public/member read of sellable data; only server/Admin mutation.

### orders / payment_submissions
Orders are immutable financial intent records except for state transitions. Slip submissions are versioned so re-upload after rejection preserves history.

### suspensions / appeals
Do not overwrite suspension history. Use row history/status transitions.

### member_session_metadata
Session UX metadata only. Supabase Auth remains the actual session authority.

## 16. AI integration

Before any member AI call, server runtime resolves a member access snapshot:
- user status
- suspension/deletion state
- plan
- AI entitlements
- current balances

If suspended, deleting, or out of credit, reject before provider execution.

After provider execution:
- calculate internal AI cost using existing AI usage accounting
- convert cost to credits using current conversion rate
- debit monthly first, then purchased
- write credit ledger and AI usage records

To avoid overspending under concurrency, balance checks and debits must use a single database transaction/RPC with row locking or equivalent atomic logic.

Because exact provider cost may only be known after generation, v1 should reserve an estimated upper-bound amount before execution and settle to actual usage after execution. Failed provider calls release unused reservation. This prevents simultaneous requests from overspending a small balance.

## 17. RLS and security

- Member tables use RLS.
- A member may only read/update allowed rows tied to `auth.uid()`.
- Sensitive financial/moderation mutation happens through server-side service-role APIs/RPC.
- Member cannot directly write plan, credits, subscription, suspension, payment approval, or audit tables.
- Avatar bucket restricts member write path to their own user folder.
- Slip bucket is private; only owner and authorized Admin/server access.
- Audit/ledger tables are never client-writable.

## 18. Decomposition / implementation phases

This design is intentionally split into independently testable phases:

1. **Member Core** — Auth, profile, onboarding, member shell, security basics.
2. **Credits & Entitlements** — plans, wallets, atomic credit handling, AI gating.
3. **Orders & Payments** — catalog, PromptPay, slips, Admin review, promotions.
4. **Moderation & Notifications** — suspension, appeals, deletion grace period, notification center/email.
5. **Creations & Admin Member Center** — member history/continuation and full Admin member management.

Each phase gets its own implementation plan and must pass tests/typecheck/build before the next production merge.

## 19. Non-goals for v1

- Google/social login
- Mandatory email verification
- Public profiles
- Community/social features
- Referral program
- Coupon codes
- Automatic slip verification
- Automatic payment gateway
- Per-request credit usage UI
- Member-visible credit ledger
- New-device email alerts
