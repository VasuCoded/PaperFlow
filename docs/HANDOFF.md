# Session handoff — 3 Sep 2026

Written at the end of the first build session. The **"Prompt for the next
session"** block at the bottom is meant to be pasted verbatim as the first
message of the following Claude Code session.

11 commits · 7 tags · 78 files · 108 tests green · 8 migrations

---

## 1. What got built

| CP | Scope | State |
|---|---|---|
| C0 | Repo, tooling, DB-control guardrails | Done |
| C1 | Multi-tenant schema, RLS, taxonomy, seeds | Done (migrations written + grammar-validated; apply needs Docker) |
| C5 | Paper generator (pure) | Done — 60 tests |
| C6 | Multi-set shuffle engine (pure) | Done — property tests |
| C7 | Print output (A4, KaTeX+mhchem, per-set papers/keys/mapping) | Done |
| C10 | Practice matcher + analytics (pure) | Done — 10 tests |
| C3 | Ingestion standing brief | Doc only |
| C12 | Ops scaffolding (backup, keep-alive, restore, runbook) | Partial |
| C2 | Auth, membership, batches | **Not built** — needs live DB + OAuth |
| C2b | Platform console | **Not built** — needs C2 |
| C8 | Teacher screens | **Not built** — needs live DB + types |
| C9 | Student screens (PWA) | **Not built** — needs live DB + types |

C2/C2b/C8/C9 were deliberately skipped: they need the live database, generated
types and OAuth, and `CLAUDE.md` forbids untyped database access — writing them
blind would break the project's own rules and could not be verified.

---

## 2. Bugs found and fixed

### Product bugs caught by printing the PDF

Every one of these was found by printing, not by tests.

1. **All three "sets" were identical** *(critical)* — same questions in the same
   order, only the header letter differed. The C6 shuffle engine was built and
   fully tested but the print route never called it. Fixed with
   `src/lib/print/compose.ts`, which joins shuffle → print and renumbers each set.
2. **Mapping sheet printed raw TeX** — `MappingSheet` rendered its answer as
   plain text while the other two components used `renderRich`.
3. **Mapping sheet discarded most answers** — the "shorten to see key" rule
   measured *TeX source* length, not rendered length, so compact equations with
   verbose source were thrown away. Now only genuinely multi-part blocks defer.
4. **Chemistry rendered as an unknown command** — mhchem was imported as
   `katex/dist/contrib/mhchem`, a deep path that bypasses the package exports
   map, loads the UMD build and registers macros on a *different* katex
   instance. Correct specifier: `katex/contrib/mhchem`.
5. **No page breaks between artefacts** — all 7 documents flowed continuously; a
   teacher would have had to cut sheets.
6. **No math rendering at all** — C7 specifies server-rendered KaTeX; skipped in
   the first pass.
7. **Hindi treated as a translation layer** *(design error)* — a Devanagari
   translation of an English question sat inside a Science paper. Hindi is a
   *subject*; it now has its own paper at `/print/sample/hindi`.

### Caught before shipping

- **The mhchem test was a false positive** — it asserted the output lacked the
  literal `\ce{`, but KaTeX consumes the brace separately, so it passed on
  broken output. Replaced with error-styling assertions plus a "guard the guard"
  case proving they can fail.
- **Invalid hex in test-fixture UUIDs** — mnemonic ids used `t`/`s`/`p`/`u`.
- **Tenancy lint was too strict** — it banned all uses of `is_platform_owner()`
  in policies; the plan bans only the `or is_platform_owner()` escape hatch.

### Tooling / environment

- `create-next-app` rejects capitalised folder names → scaffolded manually.
- husky's default pre-commit ran tests and blocked the first commit.
- Missing `pg` types and an implicit-any cookie callback broke strict typecheck.
- vitest "React is not defined" — tsconfig uses `jsx: "preserve"` for Next, so
  esbuild stayed on the classic runtime; vitest now uses the automatic runtime.
- Windows `cmd.exe` ignores `VAR=value` prefixes → `cross-env`.

### Operational mistakes (mine)

Twice I broke the running dev server by touching `.next` while it was live —
once with `rm -rf .next`, once with `npm run build`. `next build` and `next dev`
share that directory. Guard added: `next.config.ts` honours `NEXT_DIST_DIR` and
`npm run build:check` builds into `.next-build`. Plain `npm run build` still
uses `.next`, so Vercel is unaffected.

---

## 3. Repository structure

```
PaperFlow/
├─ CLAUDE.md              project rules — tenancy, roles, DB, code (CI-enforced)
├─ README.md              orientation + checkpoint status
├─ .mcp.json              hosted Supabase MCP (dev only, never prod write)
├─ docs/
│  ├─ BUILD-PLAN.md       THE SPEC (v3.0). §5 data model, §7 checkpoints, §11 ritual
│  ├─ SETUP.md            bring-online checklist (Docker, cloud, env, OAuth)
│  ├─ RUNBOOK.md          onboarding, activation gate, restore, rotation, SEV-1
│  ├─ HANDOFF.md          this file
│  ├─ ingest-instructions.md   C3 standing brief for ingestion sessions
│  ├─ global-tables.txt   tenancy-lint allowlist
│  ├─ taxonomy/*.csv      NCERT chapter lists
│  └─ patterns/*.json     CBSE paper patterns + generic unit test
├─ supabase/
│  ├─ migrations/         0001 tenancy → 0008 rls_policies (dependency-ordered)
│  └─ tests/              seed_fixtures + tenancy / rls / isolation suites
├─ scripts/
│  ├─ tenancy-lint.ts     every table has a tenant key or is allowlisted
│  ├─ db-guard.sh         pre-push: blocks DROP/TRUNCATE/DELETE-without-WHERE
│  ├─ seed-taxonomy.ts    docs/taxonomy/*.csv → classes/subjects/chapters
│  ├─ seed-patterns.ts    docs/patterns/*.json → paper_patterns
│  └─ restore.sh          pg_restore a dump into a target DB
└─ src/
   ├─ app/                routes: / , /print/sample , /print/sample/hindi
   ├─ components/print/   QuestionPaper · AnswerKey · MappingSheet (+ render tests)
   ├─ lib/db/             client (anon) · server (session) · admin (service role)
   ├─ lib/print/          model · math (KaTeX/mhchem) · compose · sample-paper
   └─ server/
      ├─ generator/       C5 paper generator — pure, 60 tests
      ├─ sets/            C6 shuffle engine — pure, property tests
      └─ practice/        C10 matcher + analytics — pure, 10 tests
```

---

## 4. Verification commands

```bash
npm install
npm run typecheck        # tsc --noEmit, strict, no any
npm test                 # 108 tests
npm run lint
npm run build:check      # safe while a dev server is running
npm run dev -- -p 3005   # then open /print/sample and /print/sample/hindi

# once Docker + Supabase local are up
npx supabase db reset
npm run db:types
psql "$SUPABASE_DB_URL" -f supabase/tests/tenancy.test.sql
psql "$SUPABASE_DB_URL" -f supabase/tests/rls.test.sql
psql "$SUPABASE_DB_URL" -f supabase/tests/isolation.test.sql
npm run tenancy-lint
```

---

## 5. Prompt for the next session

Paste everything between the lines as the first message.

---

```text
Read docs/BUILD-PLAN.md and CLAUDE.md before doing anything. They are the
spec and the rules. The rules in CLAUDE.md are load-bearing and CI-enforced.

PROJECT
PaperFlow - multi-tenant question bank + mistake-practice platform for
classes 9-12 (PCMB, Social Science, English, Hindi). Tests are on paper; the
app never does online test-taking and never scores. Built from
docs/BUILD-PLAN.md v3.0.

STATE - all committed and tagged, 108 tests green, typecheck/lint/build clean
  C0   scaffold, tooling, DB guardrails             tag C0
  C1   full multi-tenant schema, RLS, seeds         tag C1
  C5   paper generator (pure)                       tag C5-C6
  C6   multi-set shuffle engine (pure)              tag C5-C6
  C7   print output, KaTeX, shuffle wiring          tags C7, C7-fixes, C6-C7-wired
  C10  practice matcher + analytics (pure)          tag C10
  C3   ingestion standing brief (doc only)
  C12  ops scaffolding: backup, keep-alive, runbook

NOT BUILT - these needed the live database and generated types:
  C2   auth, membership, batches
  C2b  platform console
  C8   teacher screens
  C9   student screens (PWA)

READ IN THIS ORDER
  1. CLAUDE.md                      rules: tenancy, roles, database, code
  2. docs/BUILD-PLAN.md             section 5 data model, 7 checkpoints, 11 ritual
  3. docs/SETUP.md                  what infrastructure exists
  4. supabase/migrations/*.sql      0001-0008, schema in dependency order
  5. supabase/tests/*.sql           what the tenancy/rls/isolation suites assert
  6. src/server/generator, sets, practice   the pure engines, all tested
  7. src/lib/print/                 print model, math, compose layer

DECISIONS ALREADY MADE - do not undo these
  - The platform institute UUID is the fixed constant
    11111111-1111-1111-1111-111111111111, returned by platform_institute_id().
    PLATFORM_INSTITUTE_ID env must equal it. SQL migrations cannot read env
    vars, so it is hardcoded there deliberately.
  - A pattern section places `questionCount` BLOCKS, each worth `marksEach`
    (one block = one display position). A stimulus block's sub-questions sum
    to marksEach. This is what makes the marks-per-position invariant natural.
  - questions.answer/solution/rubric/correct_option/numeric_answer/tolerance
    are REVOKEd from authenticated+anon at COLUMN level. Student reads go
    through get_question_solution(), which checks can_read_solution().
    Teacher answer keys are produced server-side. Do not add these columns
    back into any client query.
  - institute_admin may manage paper_patterns owned by their OWN institute
    (patterns are structure, not answer keys). They may never write questions
    or stimuli, for any owner.
  - tenancy-lint bans the escape-hatch pattern "or is_platform_owner()" inside
    a create policy - NOT all uses. Sole-clause platform write policies on the
    global/bank tables are intended and correct.
  - Math authoring format inside question bodies: $...$ inline, $$...$$
    display, \ce{...} for chemistry. Import mhchem as "katex/contrib/mhchem".
    The deep path "katex/dist/contrib/mhchem" bypasses the package exports
    map and silently registers macros on a different katex instance, so \ce
    renders as an unknown command in red.
  - Every printed artefact (each set's paper, each key, the mapping sheet)
    starts on its own page. Sets must differ in ORDER, never only by the
    letter in the header.
  - Delivery is WEB FIRST: a website on Vercel, every role and login included.
    A Capacitor native shell is a possible later step around the same web app,
    not a rewrite, and it does not change anything now. Keep rendering on the
    server - the institute is resolved server-side on every request, which a
    static export could not do. See docs/DELIVERY.md, which also records that
    Google OAuth does not work in a plain webview (that is the one real cost
    of the Capacitor step, and it is costed there).
  - Both Supabase projects are in Mumbai (ap-south-1) and vercel.json pins
    functions to bom1. Region is fixed at Supabase project creation; do not
    create a project in another region.

ENVIRONMENT GOTCHAS (Windows)
  - npm runs scripts through cmd.exe, so a VAR=value prefix fails. Use
    cross-env (already a devDependency).
  - `next build` and `next dev` share .next. Building or cleaning it while a
    dev server runs corrupts the running app. Use `npm run build:check`,
    which builds into .next-build.
  - Run the dev server on a spare port: `npm run dev -- -p 3005`.

WHAT I HAVE DONE SINCE THAT SESSION
  - Docker Desktop installed; local Supabase running; migrations applied with
    `supabase db reset`; the three SQL suites run.
  - src/lib/database.types.ts regenerated with `npm run db:types`.
  - Supabase projects, GitHub repo, Vercel and Google OAuth configured.
  - Platform owner membership bootstrapped per RUNBOOK section 1.
  (If any of these is not true, tell me and stop before writing code.)

NEXT CHECKPOINT: C2 - auth, membership, batches. Follow the C2 prompt in
docs/BUILD-PLAN.md section 7 exactly.

Before writing any code, give me your plan in five bullets and stop.
Do not modify anything outside the scope of C2.
```
