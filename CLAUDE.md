# Project rules

## Tenancy

- This is a multi-tenant application. Every row of tenant data belongs to
  exactly one institute. There is no "global" tenant and no null
  institute_id — the shared question bank is owned by a real row in
  `institutes` with kind='platform'.
- Every new table is either tenant-scoped with `institute_id uuid not null`,
  or on the global reference allowlist (classes, subjects, class_subjects,
  strands, chapters, topics). There is no third option. CI enforces this.
- RLS policies must never establish tenancy by joining to a parent table.
  Filter on the row's own institute_id.
- Any server code using the service role key bypasses tenancy. It MUST
  filter by institute_id explicitly. Treat a service-role query with no
  institute_id predicate as a bug, every time.
- NEVER add `or is_platform_owner()` to a table policy. Platform access to
  tenant data goes through the audited functions in section 5.8.

## Database

- The database is the product. The question bank represents hundreds of hours
  of irreplaceable human review, and it now also holds other people's
  students. Treat every write as if it cannot be undone.
- NEVER run `supabase db reset` against anything but the local stack.
- NEVER run DELETE or TRUNCATE without a WHERE clause. If a task seems to
  need one, stop and ask.
- NEVER run DDL against production. Production schema changes go through
  migration files applied by `supabase db push`, reviewed by a human first.
- Every schema change is a migration file in `supabase/migrations/`, named
  `<timestamp>_<verb>_<object>.sql`. No dashboard edits, ever.
- Every migration includes its down SQL as a trailing comment block.
- Every new table gets RLS enabled in the same migration that creates it.
- After any schema change:
  `supabase gen types typescript --local > src/lib/database.types.ts`
- Before any bulk data operation:
  `pg_dump "$SUPABASE_DB_URL" -Fc -f backups/pre-<task>-$(date +%s).dump`

## Scope

- The app supports classes 9-12 and subjects PCMB, Social Science, English,
  Hindi. Never hardcode a class, a subject, a chapter or a paper pattern.
  If you find yourself writing `if (subject === 'Biology')`, stop.
- Only class-subjects active FOR THE CURRENT INSTITUTE appear in
  teacher-facing UI. Read them from `my_active_class_subjects`. Never
  filter on status by hand.
- Text handling must be script-agnostic. Devanagari rows use the `simple`
  text search configuration and NFC normalisation.

## Roles

- Four roles: platform_owner, institute_admin, teacher, student. The word
  "admin" alone is ambiguous in this codebase — never use it unqualified
  in a variable name, a route, a policy or a comment.
- platform_owner is membership with role='owner' on the platform institute.
  It is NOT a boolean on profiles. Do not add one.
- Sign-in is Google OAuth only and carries no role and no institute. A new
  user belongs to nothing until they accept an invite or enter a join code.
- Never build a role selector, a role field on a signup form, an "I am a
  teacher" checkbox, or a public institute-creation form.
- NEVER write an API route, server action, or RPC that updates
  institute_members.role. Changes go through set_member_role, which writes
  an audit row.
- institute_admin must never gain write access to questions or stimuli, for
  the shared bank or their own private layer. The review gate is the only
  thing between a wrong answer key and a parent, and it is now between one
  tenant's mistake and every other tenant's papers.

## Code

- TypeScript strict mode. No `any`, no `@ts-ignore`.
- All database access through generated types.
- Anything touching the service role key is server-side only.
- No client-side query may return solution, answer or rubric. Those come
  from a server route that checks the attempt gate.
- The current institute is resolved server-side from the session on every
  request. Never from a URL parameter, a cookie, or client state. A route
  that takes institute_id from the client is a tenancy bug even if RLS
  would have caught it.

## Working style

- Read `docs/BUILD-PLAN.md` before starting a checkpoint.
- Do not start work on a later checkpoint because it seems related.
- When a requirement is ambiguous, ask once and stop.
- Write tests before implementation for the paper generator, the shuffle
  engine, the practice matcher and every RLS policy. Those are where silent
  wrongness lives.
