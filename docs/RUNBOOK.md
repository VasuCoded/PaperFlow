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
2. Create the institute (only path that inserts into `institutes`):
   ```sql
   select public.create_institute('Institute Name','institute-slug',
     'contact@institute.test','first.admin@institute.test');
   ```
   (Or via `/platform/institutes/new` once C2b is built.)
3. The first admin signs in with Google, accepts the invite on `/welcome`.
4. Admin invites teachers and assigns their class-subjects.
5. Activate class-subjects whose `bank_status='ready'` **on request** (§4).
6. Admin creates batches and hands out join codes.

## 3. Activate a class-subject for an institute (§C11 gate)

Do **not** flip to `active` unless the gate passes:

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
would have set. Then, from an activation request:

```sql
select public.decide_activation_request(:request_id, true, null);
```

## 4. Pull a bad question from circulation

Never DELETE. Retire it (platform owner):

```sql
update public.questions set status='retired' where id = :qid;  -- shared or private
```

A tenant flag (`question_flags`) suppresses a shared question **for that tenant
only** and never changes its status. Platform review decides retirement.

## 5. Correct a student's wrong set (§3.4)

A student who logged against the wrong set poisons their weak-spot map silently.
The transactional remap (C10) is exposed at `/teacher/papers/[id]` and, for
platform support, at `/platform/support`. It must, in ONE transaction: remap
each `attempt_item` to the correct `question_id` via the correct set, delete the
practice set built from the wrong mapping, rebuild it, and leave
`question_exposure` consistent. Do not do this with ad-hoc UPDATEs.

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

1. `/institute/export` (or the platform export) → hand over their JSON + PDFs.
2. `update public.institutes set status='suspended' where id = :inst;`
3. Keep data for the agreed notice period, then remove on request.

## 10. Cross-tenant data report → SEV-1

If any tenant reports seeing another tenant's data:

1. **Suspend** the suspected path immediately (feature flag / take the route down).
2. **Verify** with the isolation suite (`supabase/tests/isolation.test.sql`) and
   `platform_access_log`.
3. **Disclose** to affected institutes per your agreement. Do not wait to be sure
   it was exploited — the isolation suite existing is what lets you scope it fast.

This is the top risk in the project (§10). The tenancy lint, the enumerated
isolation suite, and three-institute dev/staging data exist to keep it at zero.
