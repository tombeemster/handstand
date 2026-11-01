# The metrics Worker

Stores the anonymous session summaries: app → this Cloudflare Worker → Supabase. Only used when the
parent turns on "Share anonymous totals". No secrets in this folder; the repo is public.

- `index.js`: the Worker. POST only, from the live app's origin only; checks every field; logs nothing.
- `schema.sql`: the table. Row level security on, no policies: only the Worker's key gets in.
- `test.mjs`: tests without network or accounts: `node worker/test.mjs`.
- `test-live.sh`: tests the deployed Worker.

## Set up

1. **Supabase:** new project, region EU Central (Frankfurt). Paste `schema.sql` into the SQL editor and run it.
2. **Cloudflare:** from this folder, log in and set the two secrets (each asks for the value; it's never
   stored in a file). `SUPABASE_URL` is the project URL (`https://<ref>.supabase.co`); `SUPABASE_KEY` is the
   project's secret key (Project Settings → API Keys), which must never go in the app or this repo.
   ```bash
   npx wrangler login
   npx wrangler secret put SUPABASE_URL
   npx wrangler secret put SUPABASE_KEY
   npx wrangler deploy
   ```
3. **Check it:** `bash worker/test-live.sh <worker url>`, then remove its test row:
   `delete from public.session_summaries where app_version = '0.0.0';`

Workers Logs and Logpush stay off: the privacy page promises nothing about requests is kept.
