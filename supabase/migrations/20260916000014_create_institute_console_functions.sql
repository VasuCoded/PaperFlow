-- ============================================================================
-- 0014 · INSTITUTE CONSOLE FUNCTIONS
--
-- /institute/subjects lists EVERY class-subject, including the ones this
-- institute cannot use yet, with the reason (BUILD-PLAN C12: "an empty
-- dropdown makes an app look broken; an honest 'not yet' does not"). That
-- needs, per class-subject: bank status, approved shared and private counts,
-- this institute's activation status, and any pending or declined request —
-- in one query, not one per subject.
--
-- SECURITY INVOKER: it runs under the caller's RLS. Called with somebody
-- else's institute id it returns only what the caller could already see —
-- shared counts, and zeros and 'planned' for everything tenant-specific.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- activation_requests uniqueness. unique (institute_id, class_subject_id,
-- status) meant a subject could be declined only ONCE per institute: the
-- second decision to decline (or to approve, after a deactivation) violated
-- it and decide_activation_request failed. The rule that matters is "at most
-- one PENDING request per subject"; history may hold many decided rows.
-- ----------------------------------------------------------------------------
alter table public.activation_requests
  drop constraint if exists activation_requests_institute_id_class_subject_id_status_key;

create unique index if not exists activation_requests_one_pending
  on public.activation_requests (institute_id, class_subject_id)
  where status = 'pending';

create or replace function public.institute_subject_overview(p_institute_id uuid)
returns table (
  class_subject_id uuid,
  class_name text,
  subject_name text,
  bank_status text,
  approved_shared int,
  approved_private int,
  status text,
  pending_request boolean,
  last_decline_reason text,
  last_declined_at timestamptz
)
language sql stable
set search_path = public
as $$
  with counts as (
    select q.class_subject_id,
           count(*) filter (where q.owner_institute_id = public.platform_institute_id())::int as shared,
           count(*) filter (where q.owner_institute_id = p_institute_id)::int as private
    from public.questions q
    where q.status = 'approved'
    group by q.class_subject_id
  )
  select
    cs.id,
    cl.name,
    s.name,
    cs.bank_status,
    coalesce(c.shared, 0),
    coalesce(c.private, 0),
    coalesce(ics.status, 'planned'),
    exists (
      select 1 from public.activation_requests r
      where r.institute_id = p_institute_id and r.class_subject_id = cs.id and r.status = 'pending'
    ),
    d.reason,
    d.decided_at
  from public.class_subjects cs
  join public.classes cl on cl.id = cs.class_id
  join public.subjects s on s.id = cs.subject_id
  left join counts c on c.class_subject_id = cs.id
  left join public.institute_class_subjects ics
    on ics.institute_id = p_institute_id and ics.class_subject_id = cs.id
  left join lateral (
    select r.reason, r.decided_at from public.activation_requests r
    where r.institute_id = p_institute_id and r.class_subject_id = cs.id and r.status = 'declined'
    order by r.decided_at desc nulls last
    limit 1
  ) d on true
  order by nullif(regexp_replace(cl.name, '\D', '', 'g'), '')::int nulls last, cl.name, s.name
$$;

grant execute on function public.institute_subject_overview(uuid) to authenticated;

-- ============================================================================
-- DOWN
-- ============================================================================
/*
drop function if exists public.institute_subject_overview(uuid);
drop index if exists public.activation_requests_one_pending;
-- Only restorable if no (institute, subject, status) duplicates exist by then.
alter table public.activation_requests
  add constraint activation_requests_institute_id_class_subject_id_status_key
  unique (institute_id, class_subject_id, status);
*/
