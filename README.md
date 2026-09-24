# PaperFlow

PaperFlow generates printed question papers from a reviewed question bank, then
turns each student's wrong answers into a practice set on exactly those topics.

**Who it is for:** coaching institutes and schools teaching CBSE classes 9 to 12.
Teachers set and print papers, students log their mistakes on a phone, and the
institute's owner runs their own members and subjects. Tests stay on paper: the
app never conducts a test online and never scores anyone.

**Live:** [paperflowindia.vercel.app](https://paperflowindia.vercel.app)

Accounts are created by invitation, a batch join code, or an access request that
an institute approves, so the live link opens at a sign-in page. There is no
public sign-up into someone else's institute by design.

## What it does

**Setting a paper (teacher)**
- Pick a class, subject and chapters, then a layout: a CBSE board pattern, a
  saved institute layout, a quick template (15-minute quiz, 25/50/100 MCQ test,
  20-mark class test, 25-mark unit test, 40-mark chapter test, 80-mark term
  exam), or a custom layout with its own sections, question kinds, marks,
  internal choice, time and instructions.
- Set the easy/medium/hard mix from presets or your own percentages.
- Each section shows how many matching questions the chosen chapters hold, so a
  layout that cannot be filled is visible before generating.
- Lock a question to keep it through a regenerate, swap one for an equivalent
  (same marks, chapter, difficulty and type), or flag one as wrong. A flagged
  question leaves that institute's papers at once.
- When a paper cannot be filled, the app lists which rule would help if relaxed
  and what it would yield. Relaxing is always the teacher's click.
- Print up to four sets of the same paper in different orders, with per-set
  answer keys, one mapping sheet, and suggested copy counts per set.
- Every paper carries a code such as `SSA-10SCI-260922-03` (institute, class and
  subject, date, that day's number) in the top margin of every printed page, and
  papers can be found by that code.

**After the test (student, installable web app)**
- The test list marks which papers still need logging.
- Logging starts by picking which printed set you wrote, with a check that
  question 1 matches, then marking questions wrong in one tap each.
- Saving builds a practice set: fresh questions on the same topics, at a similar
  level, none of them seen before, with solutions that unlock as you work.
- Weak spots lists the topics that keep coming back. There is no score, no
  percentage and no rank anywhere.
- Reading works offline; logging says plainly when it needs a connection, and
  keeps what you marked.

**Running an institute (institute admin)**
- Members: invite by username, change a role, remove someone behind a typed
  confirmation, and read the role-change log.
- Assign which teacher teaches which class and subject.
- See which subjects are available, with the reason when one is not, and request
  one that is not active yet.
- Export everything the institute owns as JSON.

**The question bank and the platform side**
- A shared bank owned by the platform, plus each institute's own private
  questions that no other institute can read.
- Every question enters as staging and reaches papers only after review. Answer,
  solution and rubric columns are readable only through a checked path, so a
  signed-in student cannot read answers through the API.
- Platform console: institutes, an audited read-only inspector, the review
  queue with maths rendered, an activation gate per class and subject, access and
  subject requests, support tools (find a person, reset a password, correct a
  student's set, retire a question, resolve flags), free-tier health, and an
  audit log with CSV export.
- Multi-tenancy is enforced in the database with row-level security, not only in
  the app. Unauthorised areas return 404 rather than 403. Platform reads of an
  institute's data go through functions that log every access.
- Maths and chemistry render server-side (KaTeX with mhchem), and Devanagari
  text is handled as its own script rather than as a translation.

## Stack

Next.js 15 (App Router), TypeScript in strict mode, Supabase (Postgres, Auth,
row-level security), Vercel (Mumbai, `bom1`), KaTeX with mhchem, a hand-written
service worker for the student app, Vitest with PGlite for tests.

## Status

Working software, not yet a product in daily use.

- 22 migrations, all applied to a live Supabase dev project.
- Deployed on Vercel and reachable at the link above, running against that dev
  database with generated test data (three invented institutes, about 2,250
  approved questions).
- 347 tests pass, including database suites that run the real migrations in
  PGlite (Postgres 18 compiled to WebAssembly) and check cross-tenant isolation
  as each role.
- The sign-in, approval and paper-generation paths have been exercised
  end-to-end against live Supabase. The screens are being walked through by a
  first outside tester now.
- **Not done:** no production database yet, so no real student data; error
  reporting (Sentry) and free-tier alerts are not set up; a measured load test
  has not been run; Google sign-in exists behind a flag but is untested. Page
  loads are slower than they should be, because the server runs in Mumbai while
  the dev database is in Sydney.

## Screenshots

<!-- SCREENSHOTS: add images here. Suggested shots, all from a local run:
     1. /teacher/generate  or  /demo/teacher/generate   setting a paper, with the layout editor open
     2. /print/sample                                   printed paper, answer key and mapping sheet
     3. /demo/app  and  /demo/app/practice              student test list and a practice set
     4. /demo/platform/bank                             the review queue with maths rendered
     Save them under docs/screenshots/ and link them below. -->

_Screenshots go here._

---

# Development

Built from `docs/BUILD-PLAN.md` v3.0.

> **Built for all. Seeded for some. Shown only where seeded.**

**Read `CLAUDE.md` before changing anything.** The tenancy and role rules there
are load-bearing. `docs/HANDOFF.md` has the current state, the open issues, and
the prompt for the next session.

## Status by checkpoint

| CP | Scope | State |
|----|-------|-------|
| C0 | Repo, tooling, DB-control guardrails | Done |
| C1 | Multi-tenant schema, RLS, taxonomy, seeds | Done, 22 migrations, executed locally and applied to the live dev project |
| C2 | Username sign-up/sign-in, access-request approvals, invites, batch join codes (Google optional) | Done |
| C2b | Platform console: institutes, inspect, review queue, activation, requests, support, health, audit | Done |
| C3 | Ingestion standing brief | Doc only (ingestion is a Claude Code session, not app code) |
| C4 | Review flow | `/platform/bank` |
| C5 | Paper generator | Done, including quick templates and custom layouts |
| C6 | Multi-set shuffle engine | Done |
| C7 | Print: per-set papers, answer keys, mapping sheet, paper codes | Done |
| C8 | Teacher: set a paper, papers, batches, flagged | Done |
| C9 | Student app: tests, set picker, logging, practice, weak spots; installable PWA | Done |
| C10 | Practice matcher + analytics | Done |
| C11 | Activation gate | In the console; the human review hours are the real cost |
| C12 | Hardening | Isolation suite, rate limits, export, staging seed, load-test script, backups, runbook. **Not done:** Sentry, email alerts, a measured load test |

`/demo` is a separate click-through prototype with fake data and no backend. It
returns 404 in production unless `NEXT_PUBLIC_ENABLE_DEMO=1`.

## Local development

No Docker needed: the database tests run the real migrations in PGlite.

```bash
npm install
npm run typecheck
npm test               # 347 tests: engines, print, PWA, and the database suites
npm run lint
npm run db:verify      # every table tenant-keyed or allowlisted, RLS on everywhere
npm run db:types:local # regenerate src/lib/database.types.ts from the migrations
npm run build:check    # production build into .next-build (safe beside a dev server)
npm run dev -- -p 3005
```

Without Supabase configured, every signed-in page redirects to `/login`, which
explains what is missing. `/demo` and `/print/sample` work with no setup.

Configuring Supabase for local work is in [docs/SETUP.md](docs/SETUP.md).

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
src/lib/paper-layout  question kinds, quick templates, custom-layout validation
src/lib/pwa           service worker policy + generator
src/lib/print         print model, KaTeX/mhchem, compose, page codes
supabase/migrations   0001–0022
tests/db              executable database suites (isolation, suspension, support, …)
scripts               schema harness, type generation, seeds, staging seed, load test
docs                  BUILD-PLAN, SETUP, RUNBOOK, HANDOFF, DELIVERY, ingest brief
```

**To put it online, follow [docs/GO-LIVE.md](docs/GO-LIVE.md):** GitHub, Supabase,
Google sign-in, Vercel, production, and giving Claude access to the dev database.
