-- ============================================================================
-- 0010 · ACTIVITY FUNCTIONS
--
-- The writes the teacher and student screens need that cannot be plain RLS
-- inserts, because each must be atomic, must resolve something server-side
-- that the client must not decide, or must touch a table the caller has no
-- write policy on:
--
--   log_attempt          student logs a paper: positions -> question ids
--   correct_attempt_set  teacher fixes a wrong set, remapping in ONE transaction
--   save_practice_set    stores a matcher result + exposure + coverage gaps
--   rotate_join_code     new globally-unique code, old one dead immediately
--   remove_member        institute admin removes a teacher or student, audited
--   withdraw_flag        a teacher takes back their own institute's flag
--
-- All SECURITY DEFINER with an explicit authorisation check at the top, and
-- every table reference pinned to the row's own institute_id.
-- ============================================================================

-- Uniqueness of join codes must be checked across ALL institutes, which an
-- invoker cannot see under RLS. The unique constraint is the backstop; this
-- makes collisions near-impossible rather than merely detected.
alter function public.generate_join_code() security definer;
alter function public.batches_set_join_code() security definer;

-- ----------------------------------------------------------------------------
-- log_attempt
--
-- attempt_items stores question_id, resolved from the TAPPED display position
-- through the chosen set's paper_set_items (BUILD-PLAN C9 item 4). The client
-- sends positions only; it never names a question. Re-logging replaces the
-- previous attempt's items, and invalidates any practice set built from them.
-- ----------------------------------------------------------------------------
create or replace function public.log_attempt(
  p_paper_id uuid,
  p_paper_set_id uuid,
  p_wrong_positions int[]
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_paper record;
  v_set_count int;
  v_set uuid;
  v_attempt uuid;
begin
  select id, institute_id, class_subject_id into v_paper
  from papers where id = p_paper_id;
  if v_paper.id is null or not can_access_paper(p_paper_id) then
    raise exception 'paper not found';
  end if;
  if coalesce(my_role(v_paper.institute_id), '') <> 'student' then
    raise exception 'only a student can log their own paper';
  end if;

  select count(*) into v_set_count from paper_sets
  where paper_id = p_paper_id and institute_id = v_paper.institute_id;

  if v_set_count = 0 then
    raise exception 'this paper has no printed sets';
  elsif v_set_count = 1 then
    select id into v_set from paper_sets
    where paper_id = p_paper_id and institute_id = v_paper.institute_id;
  else
    -- more than one set: the student MUST say which one they wrote (3.4)
    if p_paper_set_id is null then
      raise exception 'choose the set you wrote';
    end if;
    select id into v_set from paper_sets
    where id = p_paper_set_id and paper_id = p_paper_id and institute_id = v_paper.institute_id;
    if v_set is null then
      raise exception 'that set does not belong to this paper';
    end if;
  end if;

  insert into attempts (institute_id, paper_id, student_id, paper_set_id, source)
  values (v_paper.institute_id, p_paper_id, auth.uid(), v_set, 'student')
  on conflict (institute_id, paper_id, student_id)
    do update set paper_set_id = excluded.paper_set_id, logged_at = now()
  returning id into v_attempt;

  delete from attempt_items where attempt_id = v_attempt and institute_id = v_paper.institute_id;

  -- one row per real (non-alternative) question at each position of THIS set
  insert into attempt_items (institute_id, attempt_id, question_id, is_correct, display_position)
  select v_paper.institute_id, v_attempt, pq.question_id,
         not (psi.display_position = any (coalesce(p_wrong_positions, '{}'::int[]))),
         psi.display_position
  from paper_set_items psi
  join paper_questions pq
    on pq.block_id = psi.paper_block_id
   and pq.institute_id = v_paper.institute_id
   and not pq.is_choice_alternative
  where psi.paper_set_id = v_set and psi.institute_id = v_paper.institute_id;

  insert into question_exposure (institute_id, student_id, question_id, context)
  select v_paper.institute_id, auth.uid(), pq.question_id, 'paper'
  from paper_questions pq
  where pq.paper_id = p_paper_id and pq.institute_id = v_paper.institute_id
  on conflict (institute_id, student_id, question_id) do nothing;

  -- a practice set built from the previous logging is no longer true
  delete from practice_sets
  where attempt_id = v_attempt and institute_id = v_paper.institute_id;

  return v_attempt;
end;
$$;

-- ----------------------------------------------------------------------------
-- correct_attempt_set
--
-- The student tapped positions on the sheet in their hand. If they told the app
-- the wrong set, those positions belong to the RIGHT set. Remap every item to
-- the question at the same position in the correct set, keeping each tap's
-- right/wrong, then drop the practice set built off the wrong mapping — all in
-- this one function call, so there is never a half-applied remap (C10).
--
-- Positions carry identical marks in every set (enforced by trigger), so the
-- block at a position has the same weight. Within a block, sub-questions are
-- paired by order; if the correct set's block has more sub-questions, the extra
-- ones inherit that position's result.
-- ----------------------------------------------------------------------------
create or replace function public.correct_attempt_set(
  p_attempt_id uuid,
  p_correct_set_id uuid
)
returns void
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
  if coalesce(my_role(v_attempt.institute_id), '') not in ('teacher', 'institute_admin') then
    raise exception 'only a teacher or institute admin can correct a set';
  end if;
  if not exists (
    select 1 from paper_sets
    where id = p_correct_set_id and paper_id = v_attempt.paper_id
      and institute_id = v_attempt.institute_id
  ) then
    raise exception 'that set does not belong to this paper';
  end if;
  if v_attempt.paper_set_id is not distinct from p_correct_set_id then
    return;
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
  -- data-modifying CTEs all see the same snapshot, so old_items is read before
  -- this delete takes effect
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
end;
$$;

-- ----------------------------------------------------------------------------
-- save_practice_set
--
-- Stores what the (TypeScript) matcher chose. Every question is re-checked here
-- against what this student's institute may draw from, so a crafted call cannot
-- insert a question from another institute's private layer.
--   p_items  [{ "question_id": uuid, "position": int }]
--   p_gaps   [{ "topic_id": uuid|null, "difficulty": text, "severity": text }]
-- ----------------------------------------------------------------------------
create or replace function public.save_practice_set(
  p_attempt_id uuid,
  p_items jsonb,
  p_gaps jsonb default '[]'::jsonb
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_attempt record;
  v_cs uuid;
  v_set uuid;
  v_bad int;
begin
  select a.id, a.institute_id, a.student_id, p.class_subject_id into v_attempt
  from attempts a join papers p on p.id = a.paper_id and p.institute_id = a.institute_id
  where a.id = p_attempt_id;
  if v_attempt.id is null or v_attempt.student_id <> auth.uid() then
    raise exception 'attempt not found';
  end if;
  v_cs := v_attempt.class_subject_id;

  select count(*) into v_bad
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) e
  left join questions q on q.id = (e ->> 'question_id')::uuid
  where q.id is null
     or q.status <> 'approved'
     or q.class_subject_id <> v_cs
     or q.owner_institute_id not in (platform_institute_id(), v_attempt.institute_id);
  if v_bad > 0 then
    raise exception 'practice set contains questions this student may not be given';
  end if;

  delete from practice_sets
  where attempt_id = p_attempt_id and institute_id = v_attempt.institute_id;

  insert into practice_sets (institute_id, student_id, attempt_id, class_subject_id, status)
  values (v_attempt.institute_id, auth.uid(), p_attempt_id, v_cs, 'active')
  returning id into v_set;

  insert into practice_set_items (institute_id, practice_set_id, question_id, position)
  select v_attempt.institute_id, v_set, (e ->> 'question_id')::uuid,
         coalesce((e ->> 'position')::int, 0)
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) e;

  insert into question_exposure (institute_id, student_id, question_id, context)
  select v_attempt.institute_id, auth.uid(), (e ->> 'question_id')::uuid, 'practice'
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) e
  on conflict (institute_id, student_id, question_id) do nothing;

  insert into coverage_gaps (institute_id, class_subject_id, topic_id, difficulty, severity, note)
  select v_attempt.institute_id, v_cs,
         nullif(e ->> 'topic_id', '')::uuid,
         e ->> 'difficulty',
         case when e ->> 'severity' = 'severe' then 'severe' else 'normal' end,
         'practice matcher widened scope'
  from jsonb_array_elements(coalesce(p_gaps, '[]'::jsonb)) e;

  return v_set;
end;
$$;

-- ----------------------------------------------------------------------------
-- rotate_join_code — the previous code stops working in the same statement.
-- ----------------------------------------------------------------------------
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
    or exists (
      select 1 from teacher_subjects
      where teacher_id = auth.uid()
        and institute_id = v_batch.institute_id
        and class_subject_id = v_batch.class_subject_id
    )
  ) then
    raise exception 'not authorised for this batch';
  end if;

  v_code := generate_join_code();
  update batches set join_code = v_code
  where id = p_batch_id and institute_id = v_batch.institute_id;
  return v_code;
end;
$$;

-- ----------------------------------------------------------------------------
-- remove_member — institute_members has no DELETE policy on purpose; removal
-- goes through here and is audited. An institute admin removes teachers and
-- students of their own institute only; admins are removed by the platform.
-- ----------------------------------------------------------------------------
create or replace function public.remove_member(p_institute_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_role text;
begin
  select role into v_role from institute_members
  where institute_id = p_institute_id and user_id = p_user_id;
  if v_role is null then
    raise exception 'not a member of this institute';
  end if;
  if v_role = 'owner' then
    raise exception 'the platform owner cannot be removed here';
  end if;

  if is_platform_owner() then
    null;
  elsif coalesce(my_role(p_institute_id), '') = 'institute_admin' then
    if v_role not in ('teacher', 'student') then
      raise exception 'an institute admin can only remove teachers and students';
    end if;
  else
    raise exception 'not authorised';
  end if;

  delete from teacher_subjects where institute_id = p_institute_id and teacher_id = p_user_id;
  delete from enrolments where institute_id = p_institute_id and student_id = p_user_id;
  delete from institute_members where institute_id = p_institute_id and user_id = p_user_id;

  insert into role_audit (institute_id, actor, target, old_role, new_role)
  values (p_institute_id, auth.uid(), p_user_id, v_role, null);
end;
$$;

-- ----------------------------------------------------------------------------
-- withdraw_flag — question_flags has no UPDATE policy (a flag never changes a
-- question's status); a teacher or admin may withdraw their own institute's.
-- ----------------------------------------------------------------------------
create or replace function public.withdraw_flag(p_flag_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_inst uuid;
begin
  select institute_id into v_inst from question_flags where id = p_flag_id and status = 'open';
  if v_inst is null then
    raise exception 'flag not found';
  end if;
  if coalesce(my_role(v_inst), '') not in ('teacher', 'institute_admin') then
    raise exception 'not authorised';
  end if;
  update question_flags set status = 'dismissed', resolved_at = now()
  where id = p_flag_id and institute_id = v_inst;
end;
$$;

grant execute on function public.log_attempt(uuid, uuid, int[]) to authenticated;
grant execute on function public.correct_attempt_set(uuid, uuid) to authenticated;
grant execute on function public.save_practice_set(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.rotate_join_code(uuid) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
grant execute on function public.withdraw_flag(uuid) to authenticated;

-- ============================================================================
-- DOWN
-- ============================================================================
/*
drop function if exists public.withdraw_flag(uuid);
drop function if exists public.remove_member(uuid, uuid);
drop function if exists public.rotate_join_code(uuid);
drop function if exists public.save_practice_set(uuid, jsonb, jsonb);
drop function if exists public.correct_attempt_set(uuid, uuid);
drop function if exists public.log_attempt(uuid, uuid, int[]);
alter function public.batches_set_join_code() security invoker;
alter function public.generate_join_code() security invoker;
*/
