# PaperFlow runbook

Operational procedures. Keep this current — it is the difference between a
five-minute fix and a bad evening across several customers.

---

## 0. One-time platform setup (human steps H0–H5b)

These cannot be automated and must be done under the **platform account**, never
an institute's email (BUILD-PLAN §4.1).

| Step | What | Notes |
|---|---|---|
| H0 | Platform Google account, password manager, 2FA on every service, recovery codes reachable by a second trusted person | Infra root for every tenant. Never a notes app, never pasted into chat |
| H0b | The conversation with sir (§4.1), then migrate infra off his email | Do this *before* migration, not after |
| H1 | Supabase org + two projects `qbank-dev`, `qbank-prod` | Under the platform account |
| H2 | Supabase personal access token in your shell profile | For the CLI/MCP |
| H3 | Private GitHub repo, connect to Vercel | Under the platform account. Branch-protect `main` |
| H4 | Google OAuth: consent screen, credentials, redirect URLs | Supabase Auth → Providers → Google |
| H5 | Domain, DNS → Vercel | |
| H5b | **Seed the platform institute + your own owner membership** before anyone signs in | See §1 below |

Then fill `.env.local` from `.env.local.example`. `PLATFORM_INSTITUTE_ID` MUST
equal the constant returned by `platform_institute_id()`
(`11111111-1111-1111-1111-111111111111`). The **production** service-role key
never lives on a dev machine — Vercel env + GitHub secrets only.

Required GitHub secrets: `SUPABASE_PROD_DB_URL`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET`, `ALERT_WEBHOOK`.

---

## 1. Bootstrap the platform owner (H5b)

The migration seeds the platform *institute* row, but the owner *membership* can
only be created once your auth user exists (you cannot insert into `auth.users`
from a migration in prod). After signing in once with the platform Google
account so your `profiles` row exists:

```sql
insert into public.institute_members (institute_id, user_id, role)
select public.platform_institute_id(), id, 'owner'
from auth.users where email = '<your platform email>'
on conflict (institute_id, user_id) do update set role = 'owner';
```

Run this once, in the SQL editor, as the service role. From then on everything
else is done in the app / through the RPCs — never by hand-editing memberships.

---

## 2. Onboard an institute (§4.4, target < 15 min)

1. Agree scope (which class-subjects, which pilot batches).
2. Create the institute at `/platform/institutes` → "Create an institute". It
   calls `create_institute`, the only path that inserts into `institutes`, and
   records the first admin's invite in the same transaction.
3. The first admin signs in with Google, accepts the invite on `/welcome`.
4. Admin invites teachers and assigns their class-subjects.
5. Activate class-subjects whose `bank_status='ready'` **on request** (§4).
6. Admin creates batches and hands out join codes.

## 3. Activate a class-subject for an institute (§C11 gate)

Do **not** flip to `active` unless the gate passes. `/platform/activation` and
`/platform/requests` show the first two conditions per class-subject (thinnest
chapter, thinnest topic) and ask for confirmation, naming the gap, before
activating thin. The per-institute query, including that institute's private
questions:

```sql
select c.name as chapter,
       count(*) filter (where q.difficulty='easy')   as easy,
       count(*) filter (where q.difficulty='medium') as med,
       count(*) filter (where q.difficulty='hard')   as hard,
       count(*) as total
from questions q
join chapters c on c.id = q.chapter_id
where q.status='approved' and q.class_subject_id = :cs
  and q.owner_institute_id in (public.platform_institute_id(), :inst)
group by c.name order by total;
```

Gate: no chapter < 60 approved, no topic < 8, every pattern section type has ≥3×
its required count, and the teacher confirms the sample papers are ones they
would have set. Then approve the institute's request at `/platform/requests`
(or activate directly in the matrix at `/platform/activation`). Declining
requires a reason, which the institute admin sees on `/institute/subjects`.

## 4. Pull a bad question from circulation

Never DELETE. Retire it at `/platform/support` — from its open flag
("Retire question…") or by id ("Retire a question by id"). A reason is
required. Retiring takes it out of new papers and practice for every institute,
closes its open flags, and writes the reason to the audit log
(`platform_retire_question`). Papers already made keep it.

A tenant flag (`question_flags`) suppresses a shared question **for that tenant
only** and never changes its status. Platform review decides retirement.

## 5. Correct a student's wrong set (§3.4)

A student who logged against the wrong set poisons their weak-spot map silently.
The transactional remap (C10) is exposed at `/teacher/papers/[id]` for the
student's own teacher and, for platform support, at `/platform/support` → Find
a person → "Correct to". Both run `remap_attempt_set_internal` in ONE
transaction: each `attempt_item` is remapped by position to the correct set's
question, the practice set built from the wrong mapping is deleted (the student
app rebuilds it), and `question_exposure` is left consistent — asserted by
`tests/db/support.test.ts`. The platform path requires a reason and logs it.
Do not do this with ad-hoc UPDATEs.

## 6. Restore a backup

```bash
# 1. Pull the dump from R2
aws s3 cp "s3://$R2_BUCKET/backups/<file>.dump" . --endpoint-url "$R2_ENDPOINT"
# 2. Restore into a SCRATCH project first and verify
scripts/restore.sh <file>.dump "<scratch-conn-string>"
# 3. Run the isolation suite against the scratch DB before trusting it
psql "<scratch-conn-string>" -f supabase/tests/isolation.test.sql
```

Test this against a scratch project before you ever need it for real.

## 7. Rotate a leaked key

- **Service role / anon**: Supabase dashboard → Project Settings → API → roll.
  Update Vercel env + GitHub secrets. Redeploy. The old key is dead immediately.
- **Anthropic**: console → roll; update `ANTHROPIC_API_KEY` everywhere.
- **Platform Google account**: if 2FA/recovery is at risk, this is infra root —
  treat as a sev-1, rotate credentials, re-issue recovery codes to both holders.

## 8. Free → Pro upgrade

Trigger at 70% of any limit (see `/platform/health`). Upgrade the Supabase
project in the dashboard; there is no schema change and effectively no downtime.
Confirm the keep-alive workflow can be disabled once on Pro (paused-project risk
goes away).

## 9. Offboard an institute

1. Their admin runs `/institute/export` (JSON of everything they own, plus
   papers via the print links). Do this BEFORE suspending: a suspended
   institute's admin can no longer sign in to export.
2. Suspend at `/platform/institutes` (or the institute's inspector page). Since
   migration 0012 this is enforced in the database: its members resolve to no
   institute, its join codes stop working, nothing is deleted.
3. Keep data for the agreed notice period, then remove on request.

## 10. Cross-tenant data report → SEV-1

If any tenant reports seeing another tenant's data:

1. **Suspend** the suspected path immediately (feature flag / take the route down).
2. **Verify** with the isolation suite — `npx vitest run tests/db/isolation.test.ts`
   against the migrations, and `supabase/tests/isolation.test.sql` against the
   live schema — and `/platform/audit` (platform_access_log).
3. **Disclose** to affected institutes per your agreement. Do not wait to be sure
   it was exploited — the isolation suite existing is what lets you scope it fast.

This is the top risk in the project (§10). The tenancy lint, the enumerated
isolation suite, and three-institute dev/staging data exist to keep it at zero.

## 11. Seed a staging project

A separate Supabase project, never production. Migrations first
(`supabase db push` against the staging project), then:

```bash
SUPABASE_DB_URL="<staging connection string>" \
STAGING_OWNER_EMAIL="you@gmail.com" \
STAGING_TESTERS='[{"email":"friend@gmail.com","role":"teacher","institute":"sunrise"}]' \
npm run seed:staging -- --i-know-this-is-staging
```

It builds three institutes (`staging-sunrise`, `staging-riverside`,
`staging-hilltop`), about 2,000 synthetic questions across Class 10 Science
(passes the activation gate), Class 10 Mathematics (deliberately fails it) and
Class 12 Biology, papers with two sets, logged attempts, flags, invites, an
activation request each way, and a review queue. It refuses any database that
has a non-staging institute, runs in one transaction, and is safe to re-run.

Synthetic users cannot sign in (sign-in is Google). Testers get real invites
through `STAGING_TESTERS` (institute is `sunrise`, `riverside` or `hilltop`).
`STAGING_OWNER_EMAIL` becomes platform owner only if that account has already
signed in once — sign in, then re-run the seed.
