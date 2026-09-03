# PaperFlow

Multi-tenant question bank + mistake-practice platform for classes 9–12
(PCMB + Social Science + English + Hindi). Built from `docs/BUILD-PLAN.md` v3.0.

> **Built for all. Seeded for some. Shown only where seeded.**

Tests are on paper. The app never does online test-taking or scoring — it logs
right/wrong per question and turns mistakes into targeted practice.

## Stack

Next.js 15 (App Router) · TypeScript strict · Tailwind · Supabase (Postgres +
Auth + RLS + Storage) · Vercel · Vitest + fast-check.

## Status by checkpoint

| CP | Scope | State |
|----|-------|-------|
| C0 | Repo, tooling, DB-control guardrails | ✅ done, verified |
| C1 | Full multi-tenant schema, RLS, taxonomy, seeds | ✅ migrations + tests written & grammar-validated (apply needs Docker) |
| C5 | Paper generator | ✅ done, 60 tests green |
| C6 | Multi-set shuffle engine | ✅ done, property tests green |
| C7 | Print output | ✅ presentational layer + preview; build compiles |
| C10 | Practice matcher + analytics | ✅ done, 10 tests green |
| C3 | Ingestion standing brief | ✅ doc written |
| C12 | Backup / keep-alive / restore / runbook | ✅ ops scaffolding |
| C2 | Auth, membership, batches | ⛔ needs live Supabase + Google OAuth |
| C2b | Platform console | ⛔ needs C2 |
| C8 | Teacher screens | ⛔ needs live DB + generated types |
| C9 | Student screens (PWA) | ⛔ needs live DB + generated types |

See `docs/SETUP.md` to bring it online, and `docs/HANDOFF.md` for the session
handoff (bugs fixed, repo map, and the prompt for the next session).

## Local development

```bash
npm install
npm run typecheck
npm test          # generator, shuffle, practice — 77 tests
npm run lint
npm run build
```

To run the database (needs Docker Desktop):

```bash
npx supabase start
npx supabase db reset                 # applies all migrations from empty
npm run db:types                      # regenerate src/lib/database.types.ts
psql "$SUPABASE_DB_URL" -f supabase/tests/tenancy.test.sql
psql "$SUPABASE_DB_URL" -f supabase/tests/rls.test.sql
psql "$SUPABASE_DB_URL" -f supabase/tests/isolation.test.sql
SUPABASE_DB_URL=... npx tsx scripts/seed-taxonomy.ts
SUPABASE_DB_URL=... npx tsx scripts/seed-patterns.ts
```

## Layout

```
src/app            routes (+ /print/sample preview)
src/components      print components
src/lib/db          browser / server / service-role Supabase clients
src/lib/print       print models
src/server/generator  paper generator (pure)
src/server/sets       multi-set shuffle engine (pure)
src/server/practice   practice matcher + analytics (pure)
supabase/migrations   0001–0008 schema
supabase/tests        RLS / tenancy / isolation suites + fixtures
scripts               db-guard, tenancy-lint, seeds, restore
docs                  BUILD-PLAN, SETUP, RUNBOOK, ingest brief, taxonomy, patterns
```

Read `CLAUDE.md` before changing anything — the tenancy and role rules there are
load-bearing and CI-enforced.
