# SETUP — what you need to do to bring PaperFlow online

> **Superseded by [GO-LIVE.md](GO-LIVE.md)**, the current step-by-step guide
> (GitHub → Supabase → Google sign-in → Vercel → production → Claude access).
> This file is kept for its notes on the platform account and the local
> Docker path, which the app no longer needs for testing.

The code is built. These are the **external / human** steps I cannot do from
here (they need accounts, cards, secrets, Docker, and OAuth consent). Do them
under the **platform account**, never an institute's email (BUILD-PLAN §4.1).
Ordered by dependency.

## A. Local database (unblocks C1 acceptance + type generation)

1. Install **Docker Desktop** (the Supabase local stack needs it). None was
   installed on this machine, so the migrations were written and validated
   against the real Postgres grammar but not yet applied.
2. From the repo:
   ```bash
   npx supabase start
   npx supabase db reset          # applies migrations 0001–0008 from empty
   npm run db:types               # regenerates src/lib/database.types.ts
   ```
3. Run the suites and confirm they pass, then READ tenancy.test.sql yourself
   (an enumerated test that enumerates zero tables passes beautifully):
   ```bash
   psql "$SUPABASE_DB_URL" -f supabase/tests/tenancy.test.sql
   psql "$SUPABASE_DB_URL" -f supabase/tests/rls.test.sql
   psql "$SUPABASE_DB_URL" -f supabase/tests/isolation.test.sql
   ```
4. Seed taxonomy + patterns:
   ```bash
   SUPABASE_DB_URL=... npx tsx scripts/seed-taxonomy.ts
   SUPABASE_DB_URL=... npx tsx scripts/seed-patterns.ts
   ```

> Note: if a test needs a tweak on first real run, it will be a small fixture
> fix (e.g. an `auth.users` column your Supabase version wants) — the logic and
> assertions are the substance.

## B. Cloud infrastructure (all under the platform account)

> ### ⚠ Pick the region before you click create
>
> **Choose the Mumbai / `ap-south-1` region for both Supabase projects.** A
> Supabase project's region is fixed at creation — changing it later means
> creating a new project and restoring a dump into it, with a real cutover.
> Every page in this app talks to the database on the server, so if the database
> sits in the US and your users are in India, each request pays a
> India→US→India round trip and the app will feel sluggish no matter how well
> the code is written. This is the single cheapest decision to get right and one
> of the more annoying to reverse. Verify the region in the dashboard before
> creating the project.

1. **Supabase**: create an org and two projects — `qbank-dev` and `qbank-prod`,
   **both in Mumbai (`ap-south-1`)**. Put a personal access token in your shell
   profile. Copy the project refs.
2. **GitHub**: create a private repo, push this code, connect it to **Vercel**.
   Turn on branch protection for `main` (migrations reach prod through a PR you
   read).
3. **Vercel**: import the repo. Add env vars (below). It will build on push.
   `vercel.json` already pins serverless functions to `bom1` (Mumbai) so they
   sit next to the database. Check this actually applied after your first
   deploy — region selection can be limited depending on your plan; if Vercel
   ignores it, the Supabase region is still the one that matters most.
4. **Domain**: register it, point DNS at Vercel.
5. **Cloudflare R2**: create a bucket for backups; make an access key pair.
6. **Anthropic**: an API key for ingestion (dev only).

## C. Environment variables

Copy `.env.local.example` → `.env.local` for local dev. In **Vercel** and
**GitHub Actions secrets**, set the production values. The production
service-role key must NOT live on your dev machine.

| Key | Where | Notes |
|-----|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | local, Vercel | dev vs prod |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | local, Vercel | |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel only (prod), local (dev only) | bypasses RLS **and** tenancy — treat as root |
| `SUPABASE_DB_URL` | local | for scripts/tests |
| `SUPABASE_DEV_REF` / `SUPABASE_PROD_REF` | local / CI | project refs |
| `ANTHROPIC_API_KEY` | local (dev) | ingestion |
| `PLATFORM_INSTITUTE_ID` | everywhere | MUST equal `11111111-1111-1111-1111-111111111111` |

GitHub Actions secrets for the ops workflows: `SUPABASE_PROD_DB_URL`,
`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET`,
`ALERT_WEBHOOK`.

## D. Google OAuth (needed for C2 auth)

1. Google Cloud console → OAuth consent screen + credentials (Web application).
2. Add Supabase's callback URL as an authorized redirect URI (Supabase → Auth →
   Providers → Google shows it).
3. Paste the client ID/secret into Supabase Auth → Google. Sign-in is Google
   **only** — no email/password, no role selector, ever.

## E. Bootstrap the platform owner (H5b)

After the schema is applied and you've signed in once with the platform Google
account (so your `profiles` row exists), run once (service role / SQL editor):

```sql
insert into public.institute_members (institute_id, user_id, role)
select public.platform_institute_id(), id, 'owner'
from auth.users where email = '<your platform email>'
on conflict (institute_id, user_id) do update set role = 'owner';
```

Everything after this is done in-app / via the RPCs — never by editing
memberships by hand. See `docs/RUNBOOK.md` for onboarding, activation and
incident procedures.

## F. Connect Claude Code's MCP to the dev database (optional, for ingestion)

`.mcp.json` is set up for the hosted Supabase MCP server. Set `SUPABASE_DEV_REF`
in your environment and run `/mcp` in Claude Code to authenticate. Never point it
at prod with write access (§6.1).

## What remains to build (needs the above live)

- **C2** auth/membership/batches, **C2b** platform console, **C8** teacher
  screens, **C9** student PWA. These were intentionally not built here: they
  require the live database, generated types, and Google OAuth, and CLAUDE.md
  forbids untyped DB access — so writing them blind would violate the project's
  own rules and couldn't be verified. Once A–E are done and
  `src/lib/database.types.ts` is regenerated, they can be built against real types.
- **C11** activation is human content work (~15 h per class-subject, then ~1 h
  per additional institute) — see the RUNBOOK gate.
