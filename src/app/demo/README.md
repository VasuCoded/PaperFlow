# /demo — front-end design prototype

A clickable prototype of every shell, built so the design can be reviewed before
the database exists. **Nothing here is wired to a backend.**

## Why this exists in the repo at all

`CLAUDE.md` says, in the Roles section:

> Never build a role selector, a role field on a signup form, an "I am a
> teacher" checkbox, or a public institute-creation form.

The login screen in this folder has a **demo account picker**, which is exactly
the shape of thing that rule forbids. That is a deliberate, contained exception
for design review, and it is fenced off four ways:

1. **Namespaced.** Everything lives under `/demo/*` and `src/demo/*`. No file
   outside those paths imports from them.
2. **No Supabase.** The demo session (`src/demo/session.tsx`) is `localStorage`
   only. It has no server component, issues no token and grants no access —
   picking a persona changes which mock data a React component renders, nothing
   more.
3. **Gated out of production.** `src/app/demo/layout.tsx` calls `notFound()`
   when `NODE_ENV === "production"` unless `NEXT_PUBLIC_ENABLE_DEMO=1` is set
   explicitly. It works locally by default and ships nowhere by accident.
4. **Labelled.** Every screen carries a demo bar, and the login screen states
   that the real app has no account picker.

**Do not reuse this pattern in the real auth flow.** When C2 is built, the only
way to get a role is an invite matched on a verified email, or a batch join code
— see BUILD-PLAN §4.3.

## What's real and what's mocked

| Real | Mocked |
|---|---|
| The C5 paper generator (`src/server/generator`) | The database |
| The C6 multi-set shuffle engine (`src/server/sets`) | Auth / sessions |
| The C10 practice matcher (`src/server/practice`) | Institutes, members, papers, batches |
| The design system, ported from the pitch mockups | Coverage counts and history |

The engines are pure TypeScript, so they run in the browser unchanged. When you
press **Generate paper**, that is the real generator selecting blocks under real
difficulty, topic-spread and tenancy constraints over a ~110-question sample
bank. A thin pool produces the real structured-shortfall screen, not a fake one.

## Routes

```
/demo/login                       login screen + demo personas
/demo/welcome                     "you belong to nothing yet" (invite / join code)

/demo/platform                    platform owner: overview
/demo/platform/institutes         tenant list + create_institute
/demo/platform/institutes/[id]    audited read-only inspector
/demo/platform/bank               staging review queue
/demo/platform/activation         class-subject × institute matrix + gate
/demo/platform/requests           activation request queue
/demo/platform/health             free-tier headroom, backups, per-tenant usage
/demo/platform/audit              role changes + data-access log

/demo/institute                   institute admin: overview
/demo/institute/members           invite, revoke, change role (teacher/student only)
/demo/institute/teachers          assign class-subjects
/demo/institute/subjects          status + request activation
/demo/institute/export            data export

/demo/teacher/generate            the paper generator (real engine)
/demo/teacher/papers              history + reprint
/demo/teacher/papers/[id]         sets, copies, wrong-set correction
/demo/teacher/batches             batches + join codes
/demo/teacher/flagged             flagged questions

/demo/app                         student: test list + needs-logging strip
/demo/app/log/[id]                set picker → confirmation → mistake logging
/demo/app/practice                practice set + where the loop doesn't apply
/demo/app/weak                    weak spots
/demo/app/me                      account, batches, offline note
```

## Design source

The visual system is ported from `teacher-app-demo.html` and
`student-app-demo.html` (the pitch mockups), which BUILD-PLAN C8/C9 name as the
reference: *"Match its layout, density and left rail. Do not redesign it."*
Tokens, type pairing (Newsreader / Inter / JetBrains Mono), the 196px rail and
the 390px phone frame all come from those files. Fonts are self-hosted via
`next/font` rather than the CDN the mockups used.

## Deleting it

If you would rather it did not exist, `rm -rf src/app/demo src/demo` removes it
completely — nothing else in the codebase references either path.
