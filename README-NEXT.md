# Neramit Next.js migration

Branch: `migration/vercel-supabase`

Supabase project: `Neramit` (`ulczxopzyclihsvuavzc`, Singapore).

## Required Vercel environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `DEVICE_TOKEN_PEPPER`
- `ADMIN_PASSWORD_HASH`
- `CRON_SECRET`

Never commit secret values. The legacy browser key `neramit_device_token_v1` is intentionally preserved.

## Commands

`npm install`
`npm test`
`npm run typecheck`
`npm run build`
