-- ============================================================================
-- 0016 · PLATFORM SUPPORT FUNCTIONS (BUILD-PLAN C2b item 6)
--
-- The operations that were manual SQL in v2.2, as real actions. Each is one
-- function (one transaction), starts with platform_guard(), and writes
-- platform_access_log naming the tenant it touched — with a reason, stored in
-- the new platform_access_log.detail column, because "why did the platform
-- change my student's set" is a question a customer will ask.
--
--   platform_support_lookup      find a person: memberships, enrolments,
--                                attempts (with every set of each paper), and
--                                pending invites. Logged once per tenant shown.
--   platform_correct_attempt_set remap a student's logged attempt to the set
--                                they actually wrote
--   platform_move_student        move an enrolment to another batch of the same
--                                class-subject in the same institute
--   platform_retire_question     take a question out of circulation, closing
--                                its open flags
--   platform_open_flags          open flags across institutes (logged)
--   platform_resolve_flag        resolve or dismiss one flag
--   platform_list_invites        an institute's pending invites (logged)
--   platform_invite              invite anyone to an institute, including a
--                                replacement institute admin
--   platform_revoke_invite       delete a pending invite
--
-- "Resend an invite" from the plan does not exist as an action: PaperFlow sends
-- no email. An invite is matched on the Google email at sign-in, so there is
-- nothing to resend — the console says so instead of pretending.
-- ============================================================================

alter table public.platform_access_log add column if not exists detail text;

-- ----------------------------------------------------------------------------
-- The set remap, shared by the teacher path (correct_attempt_set) and the
-- platform path. Moved here unchanged from 0010. It performs NO authorisation,
-- so no API role may execute it; callers authorise first.
-- Returns true when something changed.
-- ----------------------------------------------------------------------------
create or replace function public.remap_attempt_set_internal(
  p_attempt_id uuid,
  p_correct_set_id uuid
)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_attempt record;
begin
  select id, institute_id, paper_id, paper_set_id into v_attempt
  from attempts where id = p_attempt_id;
  if v_attempt.id is null then
    raise exception 'attempt not found';
  end if;
  if not exists (
    select 1 from paper_sets
    where id = p_correct_set_id and paper_id = v_attempt.paper_id
      and institute_id = v_attempt.institute_id
  ) then
    raise exception 'that set does not belong to this paper';
  end if;
  if v_attempt.paper_set_id is not distinct from p_correct_set_id then
    return false;
  end if;

  with old_items as (
    select ai.display_position as pos,
           ai.is_correct,
           row_number() over (partition by ai.display_position order by pq.within_block_order) as k
    from attempt_items ai
    join paper_set_items psi
      on psi.paper_set_id = v_attempt.paper_set_id
     and psi.display_position = ai.display_position
     and psi.institute_id = v_attempt.institute_id
    join paper_questions pq
      on pq.block_id = psi.paper_block_id
     and pq.question_id = ai.question_id
     and pq.institute_id = v_attempt.institute_id
     and not pq.is_choice_alternative
    where ai.attempt_id = p_attempt_id and ai.institute_id = v_attempt.institute_id
  ),
  old_by_pos as (
    select pos, bool_and(is_correct) as all_correct from old_items group by pos
  ),
  new_items as (
    select psi.display_position as pos,
           pq.question_id,
           row_number() over (partition by psi.display_position order by pq.within_block_order) as k
    from paper_set_items psi
    join paper_questions pq
      on pq.block_id = psi.paper_block_id
     and pq.institute_id = v_attempt.institute_id
     and not pq.is_choice_alternative
    where psi.paper_set_id = p_correct_set_id and psi.institute_id = v_attempt.institute_id
  ),
  removed as (
    delete from attempt_items
    where attempt_id = p_attempt_id and institute_id = v_attempt.institute_id
    returning 1
  )
  insert into attempt_items (institute_id, attempt_id, question_id, is_correct, display_position)
  select v_attempt.institute_id, p_attempt_id, n.question_id,
         coalesce(o.is_correct, op.all_correct, true),
         n.pos
  from new_items n
  join old_by_pos op on op.pos = n.pos
  left join old_items o on o.pos = n.pos and o.k = n.k;

  update attempts set paper_set_id = p_correct_set_id
  where id = p_attempt_id and institute_id = v_attempt.institute_id;

  -- the practice set was built from the wrong questions; the app rebuilds it
  delete from practice_sets
  where attempt_id = p_attempt_id and institute_id = v_attempt.institute_id;

  return true;
end;
$$;

revoke all on function public.remap_attempt_set_internal(uuid, uuid) from public, anon, authenticated;

create or replace function public.correct_attempt_set(
  p_attempt_id uuid,
  p_correct_set_id uuid
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_inst uuid;
begin
  select institute_id into v_inst from attempts where id = p_attempt_id;
  if v_inst is null then
    raise exception 'attempt not found';
  end if;
  if coalesce(my_role(v_inst), '') not in ('teacher', 'institute_admin') then
    raise exception 'only a teacher or institute admin can correct a set';
  end if;
  perform remap_attempt_set_internal(p_attempt_id, p_correct_set_id);
end;
$$;

-- ----------------------------------------------------------------------------
-- Lookup
-- ----------------------------------------------------------------------------
create or replace function public.platform_support_lookup(p_email text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_email citext := lower(trim(p_email));
  v_user record;
  v_logged int;
begin
  perform platform_guard();

  select id, email, full_name into v_user from profiles where email = v_email;

  -- One log row per tenant whose rows this call returns, so each institute's
  -- own trail shows the lookup; one row with no tenant when nothing matched.
  insert into platform_access_log (actor, institute_id, action, target_table, target_id, detail)
  select auth.uid(), x.inst, 'support_lookup', 'profiles', v_user.id, v_email::text
  from (
    select institute_id as inst from institute_members where user_id = v_user.id
    union
    select institute_id from institute_invites where email = v_email and accepted_at is null
  ) x
  where x.inst <> platform_institute_id();
  get diagnostics v_logged = row_count;
  if v_logged = 0 then
    insert into platform_access_log (actor, institute_id, action, target_table, target_id, detail)
    values (auth.uid(), null, 'support_lookup', 'profiles', v_user.id, v_email::text);
  end if;

  return jsonb_build_object(
    'user', case when v_user.id is null then null
                 else jsonb_build_object('id', v_user.id, 'email', v_user.email, 'full_name', v_user.full_name) end,
    'memberships', coalesce((
      select jsonb_agg(jsonb_build_object(
        'institute_id', m.institute_id, 'institute_name', i.name, 'institute_status', i.status,
        'role', m.role, 'since', m.created_at) order by i.name)
      from institute_members m join institutes i on i.id = m.institute_id
      where m.user_id = v_user.id and i.kind = 'institute'), '[]'::jsonb),
    'enrolments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'institute_id', e.institute_id, 'institute_name', i.name,
        'batch_id', e.batch_id, 'batch_name', b.name,
        'class_subject_id', e.class_subject_id, 'label', class_subject_label(e.class_subject_id),
        'other_batches', coalesce((
          select jsonb_agg(jsonb_build_object('id', b2.id, 'name', b2.name) order by b2.name)
          from batches b2
          where b2.institute_id = e.institute_id and b2.class_subject_id = e.class_subject_id
            and b2.id <> e.batch_id and b2.active), '[]'::jsonb)
      ) order by i.name, b.name)
      from enrolments e
      join institutes i on i.id = e.institute_id
      join batches b on b.id = e.batch_id and b.institute_id = e.institute_id
      where e.student_id = v_user.id), '[]'::jsonb),
    'attempts', coalesce((
      select jsonb_agg(t.obj order by t.logged_at desc)
      from (
        select a.logged_at, jsonb_build_object(
          'id', a.id, 'institute_id', a.institute_id, 'institute_name', i.name,
          'paper_id', a.paper_id, 'paper_title', p.title,
          'set_id', a.paper_set_id, 'set_label', s.set_label, 'logged_at', a.logged_at,
          'wrong', (select count(*) from attempt_items ai
                    where ai.attempt_id = a.id and ai.institute_id = a.institute_id and not ai.is_correct),
          'sets', coalesce((
            select jsonb_agg(jsonb_build_object('id', s2.id, 'label', s2.set_label) order by s2.set_label)
            from paper_sets s2 where s2.paper_id = a.paper_id and s2.institute_id = a.institute_id), '[]'::jsonb)
        ) as obj
        from attempts a
        join institutes i on i.id = a.institute_id
        join papers p on p.id = a.paper_id and p.institute_id = a.institute_id
        left join paper_sets s on s.id = a.paper_set_id and s.institute_id = a.institute_id
        where a.student_id = v_user.id
        order by a.logged_at desc
        limit 50
      ) t), '[]'::jsonb),
    'invites', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', inv.id, 'institute_id', inv.institute_id, 'institute_name', i.name,
        'role', inv.role, 'created_at', inv.created_at) order by inv.created_at desc)
      from institute_invites inv join institutes i on i.id = inv.institute_id
      where inv.email = v_email and inv.accepted_at is null), '[]'::jsonb)
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- Actions
-- ----------------------------------------------------------------------------
create or replace function public.platform_require_reason(p_reason text)
returns text language plpgsql immutable set search_path = public
as $$
begin
  if p_reason is null or length(trim(p_reason)) < 5 then
    raise exception 'a reason of at least five characters is required';
  end if;
  return left(trim(p_reason), 500);
end;
$$;

create or replace function public.platform_correct_attempt_set(
  p_attempt_id uuid,
  p_correct_set_id uuid,
  p_reason text
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_attempt record;
  v_reason text;
  v_to text;
begin
  perform platform_guard();
  v_reason := platform_require_reason(p_reason);

  select a.id, a.institute_id, s.set_label as from_label
    into v_attempt
  from attempts a
  left join paper_sets s on s.id = a.paper_set_id and s.institute_id = a.institute_id
  where a.id = p_attempt_id;
  if v_attempt.id is null then
    raise exception 'attempt not found';
  end if;

  if not remap_attempt_set_internal(p_attempt_id, p_correct_set_id) then
    raise exception 'the attempt is already on that set';
  end if;

  select set_label into v_to from paper_sets where id = p_correct_set_id;
  insert into platform_access_log (actor, institute_id, action, target_table, target_id, detail)
  values (auth.uid(), v_attempt.institute_id, 'correct_attempt_set', 'attempts', p_attempt_id,
          format('set %s → %s: %s', coalesce(v_attempt.from_label, '?'), v_to, v_reason));
end;
$$;

create or replace function public.platform_move_student(
  p_institute_id uuid,
  p_student_id uuid,
  p_to_batch_id uuid,
  p_reason text
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_reason text;
  v_to record;
  v_from text;
begin
  perform platform_guard();
  v_reason := platform_require_reason(p_reason);

  select id, name, class_subject_id into v_to
  from batches
  where id = p_to_batch_id and institute_id = p_institute_id and active;
  if v_to.id is null then
    raise exception 'that batch is not an open batch of this institute';
  end if;

  select b.name into v_from
  from enrolments e join batches b on b.id = e.batch_id and b.institute_id = e.institute_id
  where e.institute_id = p_institute_id and e.student_id = p_student_id
    and e.class_subject_id = v_to.class_subject_id;
  if v_from is null then
    raise exception 'the student is not enrolled in that subject at this institute';
  end if;

  update enrolments set batch_id = p_to_batch_id
  where institute_id = p_institute_id and student_id = p_student_id
    and class_subject_id = v_to.class_subject_id and batch_id <> p_to_batch_id;
  if not found then
    raise exception 'the student is already in that batch';
  end if;

  insert into platform_access_log (actor, institute_id, action, target_table, target_id, detail)
  values (auth.uid(), p_institute_id, 'move_student', 'enrolments', p_student_id,
          format('%s → %s: %s', v_from, v_to.name, v_reason));
end;
$$;

create or replace function public.platform_retire_question(p_question_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_reason text;
  v_owner uuid;
  v_flags int;
begin
  perform platform_guard();
  v_reason := platform_require_reason(p_reason);

  update questions set status = 'retired'
  where id = p_question_id and status <> 'retired'
  returning owner_institute_id into v_owner;
  if v_owner is null then
    raise exception 'question not found, or already retired';
  end if;

  update question_flags set status = 'resolved', resolved_at = now()
  where question_id = p_question_id and status = 'open';
  get diagnostics v_flags = row_count;

  insert into platform_access_log (actor, institute_id, action, target_table, target_id, detail)
  values (auth.uid(), v_owner, 'retire_question', 'questions', p_question_id,
          format('%s (closed %s open flag%s)', v_reason, v_flags, case when v_flags = 1 then '' else 's' end));
end;
$$;

create or replace function public.platform_open_flags(p_limit int default 100)
returns table (
  id uuid, institute_id uuid, institute_name text,
  question_id uuid, question_owner_name text, is_private boolean,
  class_subject_label text, body text, question_status text,
  reason text, raised_by_email text, created_at timestamptz,
  open_on_question int
)
language plpgsql security definer set search_path = public
as $$
begin
  perform platform_guard();
  insert into platform_access_log (actor, institute_id, action, target_table)
  values (auth.uid(), null, 'read_flags', 'question_flags');

  return query
  select f.id, f.institute_id, i.name,
         q.id, oi.name, q.owner_institute_id <> platform_institute_id(),
         class_subject_label(q.class_subject_id), q.body, q.status,
         f.reason, p.email::text, f.created_at,
         (select count(*)::int from question_flags f2 where f2.question_id = q.id and f2.status = 'open')
  from question_flags f
  join institutes i on i.id = f.institute_id
  join questions q on q.id = f.question_id
  join institutes oi on oi.id = q.owner_institute_id
  left join profiles p on p.id = f.raised_by
  where f.status = 'open'
  order by f.created_at
  limit greatest(1, least(p_limit, 500));
end;
$$;

create or replace function public.platform_resolve_flag(p_flag_id uuid, p_status text, p_note text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_inst uuid;
  v_note text;
begin
  perform platform_guard();
  if p_status not in ('resolved', 'dismissed') then
    raise exception 'invalid flag status';
  end if;
  v_note := platform_require_reason(p_note);

  update question_flags set status = p_status, resolved_at = now()
  where id = p_flag_id and status = 'open'
  returning institute_id into v_inst;
  if v_inst is null then
    raise exception 'flag not found, or already closed';
  end if;

  insert into platform_access_log (actor, institute_id, action, target_table, target_id, detail)
  values (auth.uid(), v_inst, 'flag_' || p_status, 'question_flags', p_flag_id, v_note);
end;
$$;

create or replace function public.platform_list_invites(p_institute_id uuid)
returns table (id uuid, email text, role text, created_at timestamptz)
language plpgsql security definer set search_path = public
as $$
begin
  perform platform_guard();
  insert into platform_access_log (actor, institute_id, action, target_table)
  values (auth.uid(), p_institute_id, 'read_invites', 'institute_invites');

  return query
  select inv.id, inv.email::text, inv.role, inv.created_at
  from institute_invites inv
  where inv.institute_id = p_institute_id and inv.accepted_at is null
  order by inv.created_at desc;
end;
$$;

create or replace function public.platform_invite(p_institute_id uuid, p_email text, p_role text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_email citext := lower(trim(p_email));
  v_id uuid;
begin
  perform platform_guard();
  if p_role not in ('institute_admin', 'teacher', 'student') then
    raise exception 'invalid role';
  end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'invalid email';
  end if;
  if not exists (select 1 from institutes where id = p_institute_id and kind = 'institute') then
    raise exception 'institute not found';
  end if;
  if exists (
    select 1 from institute_members m join profiles p on p.id = m.user_id
    where m.institute_id = p_institute_id and p.email = v_email
  ) then
    raise exception 'already a member of this institute; change their role instead';
  end if;

  insert into institute_invites (institute_id, email, role, invited_by)
  values (p_institute_id, v_email, p_role, auth.uid())
  on conflict (institute_id, email) do update
    set role = excluded.role, invited_by = excluded.invited_by,
        created_at = now(), accepted_at = null
  returning id into v_id;

  insert into platform_access_log (actor, institute_id, action, target_table, target_id, detail)
  values (auth.uid(), p_institute_id, 'invite', 'institute_invites', v_id, format('%s as %s', v_email, p_role));
  return v_id;
end;
$$;

create or replace function public.platform_revoke_invite(p_invite_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_inst uuid;
  v_detail text;
begin
  perform platform_guard();
  delete from institute_invites
  where id = p_invite_id and accepted_at is null
  returning institute_id, format('%s as %s', email, role) into v_inst, v_detail;
  if v_inst is null then
    raise exception 'invite not found, or already accepted';
  end if;
  insert into platform_access_log (actor, institute_id, action, target_table, target_id, detail)
  values (auth.uid(), v_inst, 'revoke_invite', 'institute_invites', p_invite_id, v_detail);
end;
$$;

-- The audit view shows the new detail column.
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
           coalesce(l.detail, coalesce(l.target_table, '') || coalesce(' ' || l.target_id::text, ''))
    from platform_access_log l
    left join institutes i on i.id = l.institute_id
    left join profiles pa on pa.id = l.actor
    where p_institute_id is null or l.institute_id = p_institute_id
  ) u
  order by 2 desc
  limit greatest(1, least(p_limit, 1000));
end;
$$;

grant execute on function public.platform_support_lookup(text) to authenticated;
grant execute on function public.platform_correct_attempt_set(uuid, uuid, text) to authenticated;
grant execute on function public.platform_move_student(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.platform_retire_question(uuid, text) to authenticated;
grant execute on function public.platform_open_flags(int) to authenticated;
grant execute on function public.platform_resolve_flag(uuid, text, text) to authenticated;
grant execute on function public.platform_list_invites(uuid) to authenticated;
grant execute on function public.platform_invite(uuid, text, text) to authenticated;
grant execute on function public.platform_revoke_invite(uuid) to authenticated;

-- ============================================================================
-- DOWN
-- ============================================================================
/*
drop function if exists public.platform_revoke_invite(uuid);
drop function if exists public.platform_invite(uuid, text, text);
drop function if exists public.platform_list_invites(uuid);
drop function if exists public.platform_resolve_flag(uuid, text, text);
drop function if exists public.platform_open_flags(int);
drop function if exists public.platform_retire_question(uuid, text);
drop function if exists public.platform_move_student(uuid, uuid, uuid, text);
drop function if exists public.platform_correct_attempt_set(uuid, uuid, text);
drop function if exists public.platform_require_reason(text);
drop function if exists public.platform_support_lookup(text);
-- Re-run correct_attempt_set from 20260916000010 (inline remap), then:
drop function if exists public.remap_attempt_set_internal(uuid, uuid);
-- Re-run platform_audit from 20260916000011.
alter table public.platform_access_log drop column if exists detail;
*/
