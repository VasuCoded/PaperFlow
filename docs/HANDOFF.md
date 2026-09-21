# Session handoff — 18 Sep 2026

The real app is built end to end. Nothing has run against a live Supabase
project or real Google sign-in yet — that is the next step, and it needs you.
The **"Prompt for the next session"** block at the bottom is meant to be pasted
as the first message of the next Claude Code session.

All commits local (no git remote) · 19 migrations · 308 tests green ·
typecheck, lint, tenancy lint, schema verify and production build clean.

---

## 1. State

| CP | Scope | State |
|---|---|---|
| C0 | Scaffold, tooling, DB guardrails | Done |
| C1 | Schema, RLS, taxonomy, seeds | Done — 18 migrations; executed in PGlite and applied to the live dev project |
| C2 | `/login`, `/welcome`, invites, batch join | Done |
| C2b | `/platform`: institutes, inspect, bank, activation, requests, support, health, audit | Done |
| C5–C7 | Generator, shuffle engine, print | Done |
| C8 | `/teacher`: set a paper, papers, batches, flagged | Done |
| C9 | `/app`: tests, set picker, logging, practice, weak spots, me; PWA | Done |
| C10 | Practice matcher + analytics | Done |
| C11 | Activation gate | In the console |
| C12 | Hardening | Mostly done — see §4 for what is not |

How it was verified without a live database: `scripts/schema-harness.ts` boots
PGlite (real Postgres 18 in WebAssembly) with a small Supabase shim (auth
schema, `auth.uid()`, the anon/authenticated/service roles, default grants),
applies every migration, and the tests under `tests/db` run as each role.
`npm run db:types:local` generates `database.types.ts` from that schema, so the
app's queries are type-checked against the real tables and functions.

---

## 2. What this phase built

**Consoles.** Platform owner: create/suspend institutes, audited read-only
inspector with role changes, review queue with KaTeX and a separate
promote-to-shared confirmation naming the owner, activation matrix with the
gate, requests with required decline reasons, support (find a person, correct
a set, move a batch, retire a question, resolve flags, invites), health, audit
log with CSV export. Institute admin: members (invite, revoke, role change and
removal behind typed-email confirmation, role-change log), teacher subjects,
subjects with an honest "not yet", export.

**Teacher.** Generate with live chapter counts, patterns, difficulty mix,
strand balance, printed sets with copy counts and short-section warnings,
lock/swap/flag, rendered maths and passages, and shortfall suggestions the
teacher clicks (never auto-applied). Papers with chapters and per-batch
history; reprint exact; wrong-set correction.

**Student.** Test list with a needs-logging strip across subjects, set picker
with the "is this question 1?" check (maths rendered), one-tap logging,
practice with gated solutions, weak spots, subject switcher. Installable PWA:
offline test list and practice, cached per user and cleared on sign-out,
install prompt from the second visit, logging says plainly when offline.

**Hardening.** Executable cross-tenant isolation suite (`tests/db/isolation.test.ts`),
generation rate limits per person and per institute, institute export,
staging seed (`npm run seed:staging`), load-test script (`npm run load-test`),
runbook updated to the console.

---

## 3. Bugs found and fixed this phase

Found by building against the real schema, or by the tests:

1. **Every query was untyped** — `@supabase/ssr` 0.5.2 passed three generics to a
   five-generic client; upgraded to 0.12.7.
2. **Nested selects typed as `string`** — generated types had no foreign keys.
3. **Generator rejected short papers** — a 5-point difficulty tolerance is
   unsatisfiable when one question is 6.25 points; tolerance is now at least
   one question.
4. **Preview and save could build different papers** — the pool RPC had no
   ORDER BY; now sorted deterministically.
5. **Answer keys assumed options A–D**, and shuffled option orders were never
   stored — real keys now, and orders persisted per set.
6. **Suspension did nothing in the database** — only the app hid it; members
   could still read through the API (migration 0012). Found alongside it: a
   NULL from `my_role()` made `IF NOT (… OR NULL)` skip a definer function's
   `RAISE`.
7. **An institute admin could pull any user in without an invite**, learn
   whether an email had an account, and demote a fellow admin;
   `remove_member` revealed membership to anyone (0013).
8. **A subject could be declined only once per institute** — the second
   decision violated a unique constraint (0014).
9. **Deleting a batch with papers, or an attempt with a practice set, failed** —
   composite `ON DELETE SET NULL` nulled `institute_id` too (0015).
10. **The SQL isolation suite could not catch most leaks** — it skipped the five
    `owner_institute_id` tables, left most tables empty for institute B, and
    probed writes with a WHERE clause that let a correct SELECT policy mask a
    leaky UPDATE/DELETE policy. The executable suite fixes all three and was
    mutation-tested against four kinds of planted leak.
11. **The teacher preview showed raw TeX**, and passages were missing.
12. **Offline logging failed silently** instead of saying nothing was saved.
13. **Every answer in the bank was readable by any signed-in user** — found on
    the first live Supabase run. The column-level REVOKE in 0004 did nothing,
    because Supabase grants SELECT on whole tables and a column revoke cannot
    narrow a table grant. 0018 revokes the table grant and grants back only
    the safe columns; `tests/db/columns.test.ts` now covers it.

---

## 4. Open issues — read before shipping

1. **Live so far: the dev database only.** All 19 migrations are applied to
   the dev project and the access-request flow passed an end-to-end check
   through real Supabase auth. The screens have not been clicked through in a
   browser by Claude (the preview tool in this session resolves to another
   project); the first person to use them is the owner. Google sign-in is
   untested and optional.
2. **Privacy decision needed (yours):** any member of an institute — including
   a student — can list every member of that institute, with emails, through
   the API (`institute_members_select` + `profiles_select`). The UI never shows
   a student that list. If students should not see classmates' emails, the
   policies need narrowing; it is a product call, so it was not changed.
3. *(Fixed this session.)* The pre-push guard used to check staged files —
   empty at push time — and flag `drop table` inside migration DOWN comments.
   It now checks the SQL in the commits being pushed and strips comments first;
   `bash scripts/db-guard.sh --all` audits every migration.
4. **Not built (need accounts):** Sentry with `institute_id` tags, email alerts
   at 70% of any free-tier limit and at 40% single-tenant usage.
5. **Load test not run** — it needs the seeded staging project. The C12 p95
   number is still unknown.
6. **Board patterns may not generate from staging data** — the staging seed
   only has mcq/vsa/sa/la questions; CBSE patterns with case-based or
   assertion-reason sections need those types in the bank.
7. `next lint` is deprecated in Next 16; migrate to the ESLint CLI when upgrading.

---

## 5. Repository map

```
PaperFlow/
├─ CLAUDE.md                 project rules (tenancy, roles, database, code)
├─ docs/  BUILD-PLAN · SETUP · RUNBOOK · HANDOFF · DELIVERY · ingest brief · taxonomy · patterns
├─ supabase/migrations/      0001–0008 schema + RLS; 0009 pool; 0010 activity;
│                            0011 platform; 0012 suspension; 0013 roles;
│                            0014 institute console; 0015 FK fix; 0016 support;
│                            0017 rate limit; 0018 hide answer columns;
│                            0019 username accounts + access requests
├─ supabase/tests/*.sql      psql suites for a live database (CI)
├─ tests/db/*.test.ts        the same guarantees, executable in npm test
├─ tests/app/*.test.ts       area guards, insert paths, load-test helpers
├─ scripts/
│  ├─ schema-harness.ts      PGlite + Supabase shim + migrations
│  ├─ verify-schema.ts · gen-types-local.ts · tenancy-lint.ts
│  ├─ seed-taxonomy.ts · seed-patterns.ts · seed-staging.ts · staging/
│  ├─ load-test.ts · load/   restore.sh · db-guard.sh
└─ src/
   ├─ app/(main)/            login, welcome, platform, institute, teacher, app
   ├─ app/print/             print views     app/demo/  prototype (fake data)
   ├─ app/sw.js, manifest.ts, pwa/, offline/  PWA
   ├─ server/actions · data  mutations and reads (session-scoped)
   ├─ server/generator · sets · practice   pure engines
   └─ lib/  db · print · pwa · gate · options · database.types.ts (generated)
```

---

## 6. Verification

```bash
npm install
npm run typecheck && npm test && npm run lint
npm run tenancy-lint && npm run db:verify
npm run build:check        # never `npm run build` while a dev server runs
npm run dev -- -p 3005     # /demo and /print/sample work without Supabase
```

---

## 7. Prompt for the next session

Paste everything inside the block as the first message.

```text
Read CLAUDE.md, then docs/HANDOFF.md, then the parts of docs/BUILD-PLAN.md
that HANDOFF points to. They are the rules, the state, and the spec.

PROJECT
PaperFlow - multi-tenant question bank + mistake-practice platform for
classes 9-12. Tests are on paper; the app never does online test-taking and
never scores. Web first on Vercel (Mumbai); Capacitor maybe later.

STATE
The whole app is built and committed locally (no git remote): platform and
institute consoles, teacher screens, student PWA, print, 19 migrations.
SIGN-IN IS USERNAME + PASSWORD (decided 21 Sep 2026; Google optional behind
NEXT_PUBLIC_ENABLE_GOOGLE_SIGNIN=1). New accounts get nothing until a join
code, an invite, or an approved access request (institute admin or platform
approves and picks the role). Admins and the platform can reset passwords.
The dev Supabase project (Sydney, ref hvctndzlaobbxrehuxgn) has all 19 applied
and .env.local points at it.
275 tests pass, including executable database suites that run the real
migrations in PGlite. NOTHING has run against a live Supabase project or
real Google sign-in yet. HANDOFF section 4 lists the open issues.

WHAT I HAVE DONE SINCE - following docs/GO-LIVE.md (tick before pasting)
  - [ ] 1  code pushed to a private GitHub repo
  - [ ] 2  Supabase dev project (Mumbai); migrations applied with db push
  - [ ] 3  Google sign-in configured
  - [ ] 4  signed in on localhost:3005 and made myself platform owner
  - [ ] 5  staging data loaded; teacher + student walkthroughs done
  - [ ] 6  deployed on Vercel
  - [ ] 7  production Supabase project set up
  - [ ] 10 .env.local has the dev SUPABASE_DB_URL; Supabase MCP authorised
  - [ ] Decided the student-privacy question in HANDOFF section 4 item 2
  Problems I hit (paste errors / URLs / screenshots):

TASK
First fix anything in "Problems I hit". Then, against the DEV database only
(SUPABASE_DB_URL in .env.local, and the supabase-dev MCP if authorised):
  - regenerate database.types.ts from the live schema and reconcile any
    difference with the PGlite-generated one
  - make the CI "db" job pass (the older supabase/tests/*.sql suites)
  - walk the app as each role on the live site and fix what differs from
    PGlite; report every difference you find
Never touch production. For a prod migration, give me the exact command.

If I have not reached step 2 of GO-LIVE.md yet: stop and tell me.

Before changing code, give me your plan in five bullets and wait.

DECISIONS ALREADY MADE - do not undo
  - Platform institute UUID is the constant 11111111-1111-1111-1111-111111111111.
  - The institute is resolved server-side from the session on every request;
    the pf_institute cookie is only a validated preference. Unauthorised areas
    return 404, not 403.
  - No blanket "or is_platform_owner()" in policies; platform reads of tenant
    rows go through audited SECURITY DEFINER functions that log.
  - Answer/solution/rubric columns are REVOKEd at column level; students read
    them only through get_question_solution().
  - Relaxing a generator rule is always the teacher's click, never automatic.
  - Maths: $...$, $$...$$, \ce{...}; import mhchem as "katex/contrib/mhchem".
  - Windows: use cross-env for env-prefixed scripts; never build into .next
    while a dev server runs (npm run build:check uses .next-build).
```
