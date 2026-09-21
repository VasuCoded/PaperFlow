# PaperFlow

Multi-tenant question bank + mistake-practice platform for classes 9–12
(PCMB + Social Science + English + Hindi). Built from `docs/BUILD-PLAN.md` v3.0.

> **Built for all. Seeded for some. Shown only where seeded.**

Tests are on paper. The app never does online test-taking or scoring — it logs
right/wrong per question and turns mistakes into targeted practice.

## Stack

Next.js 15 (App Router) · TypeScript strict · Supabase (Postgres + Auth + RLS)
· Vercel (Mumbai, `bom1`) · KaTeX + mhchem · Vitest + PGlite.

## Status by checkpoint

Everything below is built and tested against the real migrations running in
PGlite (Postgres 18 in WebAssembly). **None of it has run against a live
Supabase project or real Google sign-in yet** — see `docs/SETUP.md`.

| CP | Scope | State |
|----|-------|-------|
| C0 | Repo, tooling, DB-control guardrails | Done |
| C1 | Multi-tenant schema, RLS, taxonomy, seeds | Done — 19 migrations, executed locally and applied to the live dev project |
| C2 | Username sign-up/sign-in, access-request approvals, invites, batch join codes (Google optional) | Done |
| C2b | Platform console: institutes, inspect, review queue, activation, requests, support, health, audit | Done |
| C3 | Ingestion standing brief | Doc only (ingestion is a Claude Code session, not app code) |
| C4 | Review flow | `/platform/bank` |
| C5 | Paper generator | Done |
| C6 | Multi-set shuffle engine | Done |
| C7 | Print: per-set papers, answer keys, mapping sheet | Done |
| C8 | Teacher: set a paper, papers, batches, flagged | Done |
| C9 | Student app: tests, set picker, logging, practice, weak spots; installable PWA | Done |
| C10 | Practice matcher + analytics | Done |
| C11 | Activation gate | In the console; the human review hours are the real cost |
| C12 | Hardening | Isolation suite, rate limits, export, staging seed, load-test script, backups, runbook. **Not done:** Sentry, email alerts, a measured load test |

`/demo` is a separate click-through prototype with fake data and no backend.

## Local development

No Docker needed: the database tests run the real migrations in PGlite.

```bash
npm install
npm run typecheck
npm test               # 275 tests: engines, print, PWA, and the database suites
npm run lint
npm run db:verify      # every table tenant-keyed or allowlisted, RLS on everywhere
npm run db:types:local # regenerate src/lib/database.types.ts from the migrations
npm run build:check    # production build into .next-build (safe beside a dev server)
npm run dev -- -p 3005
```

Without Supabase configured, every signed-in page redirects to `/login`, which
explains what is missing. `/demo` and `/print/sample` work with no setup.

## Layout

```
src/app/(main)        the real app: login, welcome, platform, institute, teacher, app (student)
src/app/print         print views (papers, keys, mapping sheet)
src/app/demo          clickable prototype, fake data
src/server/actions    server actions (all mutations)
src/server/data       server-side reads
src/server/generator  paper generator (pure)
src/server/sets       multi-set shuffle engine (pure)
src/server/practice   practice matcher + analytics (pure)
src/lib/pwa           service worker policy + generator
src/lib/print         print model, KaTeX/mhchem, compose
supabase/migrations   0001–0019
tests/db              executable database suites (isolation, suspension, support, …)
scripts               schema harness, type generation, seeds, staging seed, load test
docs                  BUILD-PLAN, SETUP, RUNBOOK, HANDOFF, DELIVERY, ingest brief
```

**To put it online, follow [docs/GO-LIVE.md](docs/GO-LIVE.md)** — GitHub, Supabase,
Google sign-in, Vercel, production, and giving Claude access to the dev database.

Read `CLAUDE.md` before changing anything — the tenancy and role rules there are
load-bearing. `docs/HANDOFF.md` has the current state, the open issues, and the
prompt for the next session.
