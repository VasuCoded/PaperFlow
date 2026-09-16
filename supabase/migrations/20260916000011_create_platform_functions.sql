-- ============================================================================
-- 0011 · PLATFORM CONSOLE FUNCTIONS
--
-- BUILD-PLAN 5.8: the platform owner has NO blanket policy on tenant tables.
-- Every console screen that needs tenant data goes through a function here,
-- each starting with an explicit platform-owner check.
--
-- Logging rule (recorded in platform_access_log):
--   * functions that expose a TENANT'S ROWS (the review queue including private
--     questions, audit trails, per-institute changes) write one row per call;
--   * functions returning only AGGREGATE COUNTS across tenants do not, so the
--     access log stays a readable record of who looked at whose data rather
--     than a dashboard refresh counter.
-- ============================================================================

create or replace function public.platform_guard()
returns void language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_platform_owner() then
    raise exception 'platform owner only';
  end if;
end;
$$;

create or replace function public.class_subject_label(p_class_subject_id uuid)
returns text language sql stable security definer set search_path = public
as $$
  select 'Class ' || c.name || ' · ' || s.name
  from class_subjects cs
  join classes c on c.id = cs.class_id
  join subjects s on s.id = cs.subject_id
  where cs.id = p_class_subject_id
$$;

-- ----------------------------------------------------------------------------
-- Institutes (aggregate — not logged)
-- ----------------------------------------------------------------------------
create or replace function public.platform_list_institutes()
returns table (
  id uuid, name text, slug text, status text, contact_email text, created_at timestamptz,
  admins int, teachers int, students int, active_subjects int, papers int,
  last_activity timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  perform platform_guard();
  return query
  select i.id, i.name, i.slug, i.status, i.contact_email::text, i.created_at,
    (select count(*)::int from institute_members m where m.institute_id = i.id and m.role = 'institute_admin'),
    (select count(*)::int from institute_members m where m.institute_id = i.id and m.role = 'teacher'),
    (select count(*)::int from institute_members m where m.institute_id = i.id and m.role = 'student'),
    (select count(*)::int from institute_class_subjects x where x.institute_id = i.id and x.status = 'active'),
    (select count(*)::int from papers p where p.institute_id = i.id),
    greatest(
      (select max(p.created_at) from papers p where p.institute_id = i.id),
      (select max(a.logged_at) from attempts a where a.institute_id = i.id)
    )
  from institutes i
  where i.kind = 'institute'
  order by i.created_at desc;
end;
$$;

create or replace function public.platform_set_institute_status(p_institute_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  perform platform_guard();
  if p_status not in ('active', 'suspended') then
    raise exception 'invalid status';
  end if;
  update institutes set status = p_status where id = p_institute_id and kind = 'institute';
  if not found then
    raise exception 'institute not found';
  end if;
  insert into platform_access_log (actor, institute_id, action, target_table, target_id)
  values (auth.uid(), p_institute_id, 'set_status_' || p_status, 'institutes', p_institute_id);
end;
$$;

-- ----------------------------------------------------------------------------
-- Review queue (exposes private questions + answers — logged)
-- ----------------------------------------------------------------------------
create or replace function public.platform_review_queue(p_limit int default 100)
returns table (
  id uuid, owner_institute_id uuid, owner_name text, is_private boolean,
  class_subject_id uuid, class_subject_label text, chapter_name text,
  body text, options jsonb, answer text, correct_option text,
  marks int, difficulty text, source text, note text, created_at timestamptz
)
language plpgsql security definer set search_path = public
as $$
begin
  perform platform_guard();
  insert into platform_access_log (actor, institute_id, action, target_table)
  values (auth.uid(), null, 'review_queue', 'questions');

  return query
  select q.id, q.owner_institute_id, i.name,
         q.owner_institute_id <> platform_institute_id(),
         q.class_subject_id, class_subject_label(q.class_subject_id), ch.name,
         q.body, q.options, q.answer, q.correct_option,
         q.marks, q.difficulty, q.source, q.note, q.created_at
  from questions q
  join institutes i on i.id = q.owner_institute_id
  left join chapters ch on ch.id = q.chapter_id
  where q.status = 'staging'
  order by q.class_subject_id, q.owner_institute_id, q.created_at
  limit greatest(1, least(p_limit, 500));
end;
$$;

-- approve | reject | retire. Promoting a private question into the shared bank
-- is a separate, explicit flag — never a side effect of approving (C2b item 3).
create or replace function public.platform_review_question(
  p_question_id uuid,
  p_decision text,
  p_promote_to_shared boolean default false
)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_owner uuid;
begin
  perform platform_guard();
  if p_decision not in ('approve', 'reject', 'retire') then
    raise exception 'invalid decision';
  end if;

  select owner_institute_id into v_owner from questions where id = p_question_id;
  if v_owner is null then
    raise exception 'question not found';
  end if;

  if p_promote_to_shared and v_owner = platform_institute_id() then
    raise exception 'already in the shared bank';
  end if;

  update questions set
    status = case p_decision when 'approve' then 'approved' when 'reject' then 'rejected' else 'retired' end,
    owner_institute_id = case when p_promote_to_shared then platform_institute_id() else owner_institute_id end
  where id = p_question_id;

  insert into platform_access_log (actor, institute_id, action, target_table, target_id)
  values (
    auth.uid(), v_owner,
    'question_' || p_decision || case when p_promote_to_shared then '_promoted_to_shared' else '' end,
    'questions', p_question_id
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- Bank coverage vs the activation gate (aggregate — not logged)
-- ----------------------------------------------------------------------------
create or replace function public.platform_bank_coverage()
returns table (
  class_subject_id uuid, label text, bank_status text,
  approved int, staging int, chapters int,
  thinnest_chapter text, thinnest_chapter_count int, thinnest_topic_count int
)
language plpgsql stable security definer set search_path = public
as $$
begin
  perform platform_guard();
  return query
  with per_chapter as (
    select ch.class_subject_id, ch.name,
           count(q.id) filter (where q.status = 'approved')::int as n
    from chapters ch
    left join questions q on q.chapter_id = ch.id
    group by ch.class_subject_id, ch.id, ch.name
  ),
  per_topic as (
    select ch.class_subject_id,
           count(q.id) filter (where q.status = 'approved')::int as n
    from topics t
    join chapters ch on ch.id = t.chapter_id
    left join questions q on q.topic_id = t.id
    group by ch.class_subject_id, t.id
  )
  select cs.id, class_subject_label(cs.id), cs.bank_status,
    (select count(*)::int from questions q where q.class_subject_id = cs.id and q.status = 'approved'),
    (select count(*)::int from questions q where q.class_subject_id = cs.id and q.status = 'staging'),
    (select count(*)::int from chapters ch where ch.class_subject_id = cs.id),
    (select pc.name from per_chapter pc where pc.class_subject_id = cs.id order by pc.n, pc.name limit 1),
    (select min(pc.n) from per_chapter pc where pc.class_subject_id = cs.id),
    (select min(pt.n) from per_topic pt where pt.class_subject_id = cs.id)
  from class_subjects cs
  order by class_subject_label(cs.id);
end;
$$;

create or replace function public.platform_set_activation(
  p_institute_id uuid,
  p_class_subject_id uuid,
  p_active boolean
)
returns void language plpgsql security definer set search_path = public
as $$
begin
  perform platform_guard();
  if not exists (select 1 from institutes where id = p_institute_id and kind = 'institute') then
    raise exception 'institute not found';
  end if;

  insert into institute_class_subjects (institute_id, class_subject_id, status, activated_at, activated_by)
  values (p_institute_id, p_class_subject_id,
          case when p_active then 'active' else 'planned' end,
          case when p_active then now() end,
          case when p_active then auth.uid() end)
  on conflict (institute_id, class_subject_id) do update set
    status = excluded.status,
    activated_at = excluded.activated_at,
    activated_by = excluded.activated_by;

  insert into platform_access_log (actor, institute_id, action, target_table, target_id)
  values (auth.uid(), p_institute_id,
          case when p_active then 'activate_subject' else 'deactivate_subject' end,
          'institute_class_subjects', p_class_subject_id);
end;
$$;

create or replace function public.platform_activation_requests()
returns table (
  id uuid, institute_id uuid, institute_name text,
  class_subject_id uuid, class_subject_label text,
  requested_by_email text, status text, reason text,
  created_at timestamptz, decided_at timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  perform platform_guard();
  return query
  select r.id, r.institute_id, i.name, r.class_subject_id, class_subject_label(r.class_subject_id),
         p.email::text, r.status, r.reason, r.created_at, r.decided_at
  from activation_requests r
  join institutes i on i.id = r.institute_id
  left join profiles p on p.id = r.requested_by
  order by (r.status = 'pending') desc, r.created_at;
end;
$$;

-- ----------------------------------------------------------------------------
-- Health (aggregate — not logged)
-- ----------------------------------------------------------------------------
create or replace function public.platform_health()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare
  v_size bigint;
  v_rows jsonb;
begin
  perform platform_guard();
  begin
    v_size := pg_database_size(current_database());
  exception when others then
    v_size := null;
  end;

  select coalesce(jsonb_agg(jsonb_build_object('institute_id', t.institute_id, 'name', i.name, 'rows', t.n) order by t.n desc), '[]'::jsonb)
  into v_rows
  from (
    select institute_id, sum(n)::bigint as n from (
      select institute_id, count(*) as n from institute_members group by institute_id
      union all select institute_id, count(*) from enrolments group by institute_id
      union all select institute_id, count(*) from papers group by institute_id
      union all select institute_id, count(*) from paper_questions group by institute_id
      union all select institute_id, count(*) from paper_set_items group by institute_id
      union all select institute_id, count(*) from attempts group by institute_id
      union all select institute_id, count(*) from attempt_items group by institute_id
      union all select institute_id, count(*) from practice_set_items group by institute_id
      union all select institute_id, count(*) from question_exposure group by institute_id
      union all select owner_institute_id, count(*) from questions group by owner_institute_id
    ) x
    group by institute_id
  ) t
  join institutes i on i.id = t.institute_id;

  return jsonb_build_object('db_bytes', v_size, 'per_institute', v_rows);
end;
$$;

-- ----------------------------------------------------------------------------
-- Audit (exposes tenants' role history — logged)
-- ----------------------------------------------------------------------------
create or replace function public.platform_audit(p_institute_id uuid default null, p_limit int default 200)
returns table (
  kind text, at timestamptz, actor_email text,
  institute_id uuid, institute_name text, action text, target text
)
language plpgsql security definer set search_path = public
as $$
begin
  perform platform_guard();
  insert into platform_access_log (actor, institute_id, action, target_table)
  values (auth.uid(), p_institute_id, 'read_audit', 'role_audit');

  return query
  select * from (
    select 'role'::text, ra.at, pa.email::text, ra.institute_id, i.name,
           'set_member_role'::text,
           coalesce(pt.email::text, '?') || ' · ' || coalesce(ra.old_role, '—') || ' → ' || coalesce(ra.new_role, 'removed')
    from role_audit ra
    join institutes i on i.id = ra.institute_id
    left join profiles pa on pa.id = ra.actor
    left join profiles pt on pt.id = ra.target
    where p_institute_id is null or ra.institute_id = p_institute_id
    union all
    select 'access'::text, l.at, pa.email::text, l.institute_id, i.name, l.action,
           coalesce(l.target_table, '') || coalesce(' ' || l.target_id::text, '')
    from platform_access_log l
    left join institutes i on i.id = l.institute_id
    left join profiles pa on pa.id = l.actor
    where p_institute_id is null or l.institute_id = p_institute_id
  ) u
  order by 2 desc
  limit greatest(1, least(p_limit, 1000));
end;
$$;

-- ----------------------------------------------------------------------------
-- Institute data export: audited and rate limited (C12 item 8). The export
-- itself is assembled by the app with the admin's own RLS-bound client; this
-- records it and refuses a second export inside ten minutes.
-- ----------------------------------------------------------------------------
create or replace function public.log_institute_export(p_institute_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(my_role(p_institute_id), '') <> 'institute_admin' then
    raise exception 'only an institute admin can export';
  end if;
  if exists (
    select 1 from platform_access_log
    where institute_id = p_institute_id
      and action = 'institute_export'
      and at > now() - interval '10 minutes'
  ) then
    raise exception 'an export was made in the last ten minutes; try again shortly';
  end if;
  insert into platform_access_log (actor, institute_id, action, target_table)
  values (auth.uid(), p_institute_id, 'institute_export', 'institutes');
end;
$$;

grant execute on function public.platform_list_institutes() to authenticated;
grant execute on function public.platform_set_institute_status(uuid, text) to authenticated;
grant execute on function public.platform_review_queue(int) to authenticated;
grant execute on function public.platform_review_question(uuid, text, boolean) to authenticated;
grant execute on function public.platform_bank_coverage() to authenticated;
grant execute on function public.platform_set_activation(uuid, uuid, boolean) to authenticated;
grant execute on function public.platform_activation_requests() to authenticated;
grant execute on function public.platform_health() to authenticated;
grant execute on function public.platform_audit(uuid, int) to authenticated;
grant execute on function public.log_institute_export(uuid) to authenticated;

-- ============================================================================
-- DOWN
-- ============================================================================
/*
drop function if exists public.log_institute_export(uuid);
drop function if exists public.platform_audit(uuid, int);
drop function if exists public.platform_health();
drop function if exists public.platform_activation_requests();
drop function if exists public.platform_set_activation(uuid, uuid, boolean);
drop function if exists public.platform_bank_coverage();
drop function if exists public.platform_review_question(uuid, text, boolean);
drop function if exists public.platform_review_queue(int);
drop function if exists public.platform_set_institute_status(uuid, text);
drop function if exists public.platform_list_institutes();
drop function if exists public.class_subject_label(uuid);
drop function if exists public.platform_guard();
*/
