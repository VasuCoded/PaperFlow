-- ============================================================================
-- 0012 · ENFORCE INSTITUTE SUSPENSION IN THE DATABASE
--
-- Until now institutes.status = 'suspended' was honoured only by the app's
-- session resolver, which hides suspended memberships. The anon key is public,
-- so a suspended institute's members could still read through the API with
-- their own JWT. Suspension has to live where tenancy lives: in the membership
-- helpers every policy calls.
--
-- After this migration a member of a suspended institute:
--   * resolves to no institute (my_institutes) and no role (my_role), so every
--     tenant policy and every definer function that checks my_role refuses;
--   * cannot open a paper (can_access_paper), join a batch, or peek a code;
--   * cannot accept a pending invite into it;
--   * can still find out WHY, through my_suspended_institutes().
-- Nothing is deleted. Reactivating restores access exactly as it was.
--
-- The platform pseudo-institute cannot be suspended (platform_set_institute_
-- status only touches kind = 'institute'), so is_platform_owner is unchanged.
-- ============================================================================

create or replace function public.my_institutes()
returns setof uuid language sql stable security definer set search_path = public
as $$
  select m.institute_id
  from public.institute_members m
  join public.institutes i on i.id = m.institute_id
  where m.user_id = auth.uid() and i.status = 'active'
$$;

create or replace function public.my_role(inst uuid)
returns text language sql stable security definer set search_path = public
as $$
  select m.role
  from public.institute_members m
  join public.institutes i on i.id = m.institute_id
  where m.user_id = auth.uid() and m.institute_id = inst and i.status = 'active'
$$;

-- Same meaning as before; membership now goes through the helpers above rather
-- than reading institute_members directly.
create or replace function public.can_access_paper(p_paper_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.papers p
    where p.id = p_paper_id
      and p.institute_id in (select public.my_institutes())
      and (
        public.my_role(p.institute_id) in ('teacher', 'institute_admin')
        or exists (
          select 1 from public.enrolments e
          where e.student_id = auth.uid()
            and e.institute_id = p.institute_id
            and e.class_subject_id = p.class_subject_id
        )
      )
  )
$$;

-- A teacher_subjects row alone no longer makes someone a teacher: they must
-- also be a current member of an active institute. Every policy already pairs
-- teaches() with my_institutes(); definer functions did not.
create or replace function public.teaches(p_institute_id uuid, p_class_subject_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.teacher_subjects
    where teacher_id = auth.uid()
      and institute_id = p_institute_id
      and class_subject_id = p_class_subject_id
  )
  -- coalesce: my_role is NULL for a non-member, and NULL here would make
  -- "if not (... or teaches(...))" in a definer function skip its raise.
  and coalesce(public.my_role(p_institute_id), '') in ('teacher', 'institute_admin')
$$;

-- Previously read teacher_subjects directly, which let a suspended teacher
-- rotate a code. Now authorises through my_role / teaches.
create or replace function public.rotate_join_code(p_batch_id uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_batch record;
  v_code text;
begin
  select id, institute_id, class_subject_id into v_batch from batches where id = p_batch_id;
  if v_batch.id is null then
    raise exception 'batch not found';
  end if;
  if not (
    coalesce(my_role(v_batch.institute_id), '') = 'institute_admin'
    or teaches(v_batch.institute_id, v_batch.class_subject_id)
  ) then
    raise exception 'not authorised for this batch';
  end if;

  v_code := generate_join_code();
  update batches set join_code = v_code
  where id = p_batch_id and institute_id = v_batch.institute_id;
  return v_code;
end;
$$;

create or replace function public.shares_institute(target uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.institute_members b
    where b.user_id = target
      and b.institute_id in (select public.my_institutes())
  )
$$;

-- Solutions stay readable only while the student still belongs to the
-- institute the attempt or practice set was made in.
create or replace function public.can_read_solution(p_question_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.attempt_items ai
    join public.attempts a on a.id = ai.attempt_id
    where a.student_id = auth.uid()
      and ai.question_id = p_question_id
      and a.institute_id in (select public.my_institutes())
  )
  or exists (
    select 1 from public.practice_set_items psi
    join public.practice_sets ps on ps.id = psi.practice_set_id
    where ps.student_id = auth.uid()
      and psi.question_id = p_question_id
      and ps.institute_id in (select public.my_institutes())
  )
$$;

create or replace function public.peek_join_code(p_code text)
returns table (
  batch_id uuid,
  batch_name text,
  institute_id uuid,
  institute_name text,
  class_subject_id uuid,
  subject_name text,
  class_name text,
  already_enrolled_batch text
)
language sql stable security definer set search_path = public
as $$
  select
    b.id, b.name, b.institute_id, ins.name,
    b.class_subject_id, s.name, cl.name,
    (
      select b2.name from public.enrolments e
      join public.batches b2 on b2.id = e.batch_id
      where e.student_id = auth.uid()
        and e.institute_id = b.institute_id
        and e.class_subject_id = b.class_subject_id
      limit 1
    )
  from public.batches b
  join public.institutes ins on ins.id = b.institute_id
  join public.class_subjects cs on cs.id = b.class_subject_id
  join public.subjects s on s.id = cs.subject_id
  join public.classes cl on cl.id = cs.class_id
  where b.join_code = p_code and b.active = true and ins.status = 'active'
$$;

create or replace function public.join_batch(p_code text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  v_batch record;
  v_existing text;
begin
  -- A suspended institute's codes behave exactly like an unknown code: the
  -- message must not confirm that the institute exists.
  select b.id, b.institute_id, b.class_subject_id
    into v_batch
  from public.batches b
  join public.institutes i on i.id = b.institute_id
  where b.join_code = p_code and b.active = true and i.status = 'active';

  if v_batch.id is null then
    raise exception 'invalid or inactive join code';
  end if;

  select b2.name into v_existing
  from public.enrolments e
  join public.batches b2 on b2.id = e.batch_id
  where e.student_id = auth.uid()
    and e.institute_id = v_batch.institute_id
    and e.class_subject_id = v_batch.class_subject_id;

  if v_existing is not null then
    raise exception 'already enrolled in batch "%" for this subject', v_existing;
  end if;

  insert into public.institute_members (institute_id, user_id, role)
  values (v_batch.institute_id, auth.uid(), 'student')
  on conflict (institute_id, user_id) do nothing;

  insert into public.enrolments (institute_id, batch_id, student_id, class_subject_id)
  values (v_batch.institute_id, v_batch.id, auth.uid(), v_batch.class_subject_id);

  return v_batch.id;
end;
$$;

create or replace function public.accept_invite(p_invite_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_email citext;
  v_inst uuid;
  v_role text;
  v_accepted timestamptz;
  v_status text;
begin
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then
    raise exception 'not authenticated';
  end if;

  select inv.institute_id, inv.role, inv.accepted_at, i.status
    into v_inst, v_role, v_accepted, v_status
  from public.institute_invites inv
  join public.institutes i on i.id = inv.institute_id
  where inv.id = p_invite_id and inv.email = v_email;

  if v_inst is null then
    raise exception 'invite not found for this account';
  end if;
  if v_accepted is not null then
    raise exception 'invite already accepted';
  end if;
  if v_status <> 'active' then
    raise exception 'this institute is currently suspended';
  end if;

  insert into public.institute_members (institute_id, user_id, role)
  values (v_inst, auth.uid(), v_role)
  on conflict (institute_id, user_id) do update set role = excluded.role;

  update public.institute_invites set accepted_at = now() where id = p_invite_id;
end;
$$;

-- What a member of a suspended institute is allowed to know: that it is
-- suspended, and nothing else about it.
create or replace function public.my_suspended_institutes()
returns table (institute_id uuid, institute_name text, role text)
language sql stable security definer set search_path = public
as $$
  select i.id, i.name, m.role
  from public.institute_members m
  join public.institutes i on i.id = m.institute_id
  where m.user_id = auth.uid() and i.status = 'suspended'
  order by i.name
$$;

grant execute on function public.my_suspended_institutes() to authenticated;

-- ============================================================================
-- DOWN
-- ============================================================================
/*
-- Restores the pre-0012 bodies, under which suspension is advisory only.
drop function if exists public.my_suspended_institutes();
-- Re-run the definitions of my_institutes, my_role, shares_institute and
-- accept_invite from 20260903000001_create_tenancy.sql; of can_access_paper,
-- teaches, can_read_solution, peek_join_code and join_batch from
-- 20260903000008_rls_policies.sql; and of rotate_join_code from
-- 20260916000010_create_activity_functions.sql.
*/
