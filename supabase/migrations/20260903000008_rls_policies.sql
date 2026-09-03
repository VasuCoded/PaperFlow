-- ============================================================================
-- 0008 · RLS FUNCTIONS AND INTERDEPENDENT POLICIES
-- BUILD-PLAN sections 5.7 and 5.8. The policies here span multiple tables
-- (paper access via enrolment/teacher_subjects, the solution gate) so they live
-- after every table and are expressed through SECURITY DEFINER helpers to avoid
-- recursive RLS. Platform access to tenant data goes ONLY through the audited
-- inspect functions — never a blanket `or is_platform_owner()` on a table.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Authorization helpers (all SECURITY DEFINER, STABLE).
-- ----------------------------------------------------------------------------

-- Does the caller teach this class-subject at this institute?
create or replace function public.teaches(p_institute_id uuid, p_class_subject_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.teacher_subjects
    where teacher_id = auth.uid()
      and institute_id = p_institute_id
      and class_subject_id = p_class_subject_id
  )
$$;

-- Can the caller access this paper? (5.7 rule 5 & 6.) Tenancy is established by
-- the institute_id predicate; the joins below are authorization, not tenancy.
create or replace function public.can_access_paper(p_paper_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.papers p
    where p.id = p_paper_id
      and p.institute_id in (
        select institute_id from public.institute_members where user_id = auth.uid()
      )
      and (
        exists (
          select 1 from public.institute_members m
          where m.user_id = auth.uid()
            and m.institute_id = p.institute_id
            and m.role in ('teacher', 'institute_admin')
        )
        or exists (
          select 1 from public.enrolments e
          where e.student_id = auth.uid()
            and e.institute_id = p.institute_id
            and e.class_subject_id = p.class_subject_id
        )
      )
  )
$$;

-- The paper a set belongs to, for set-item/option policies.
create or replace function public.paper_of_set(p_paper_set_id uuid)
returns uuid language sql stable security definer set search_path = public
as $$
  select paper_id from public.paper_sets where id = p_paper_set_id
$$;

-- Solution gate (5.7 rule 3). True after the student has an attempt on a paper
-- containing the question, or a practice item for it.
create or replace function public.can_read_solution(p_question_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.attempt_items ai
    join public.attempts a on a.id = ai.attempt_id
    where a.student_id = auth.uid() and ai.question_id = p_question_id
  )
  or exists (
    select 1 from public.practice_set_items psi
    join public.practice_sets ps on ps.id = psi.practice_set_id
    where ps.student_id = auth.uid() and psi.question_id = p_question_id
  )
$$;

-- The ONLY client path to solution/answer/rubric (columns are revoked in 0004).
-- Returns rows only when the gate passes.
create or replace function public.get_question_solution(p_question_id uuid)
returns table (
  answer text,
  solution text,
  rubric text,
  correct_option text,
  numeric_answer numeric,
  tolerance numeric
)
language sql stable security definer set search_path = public
as $$
  select q.answer, q.solution, q.rubric, q.correct_option, q.numeric_answer, q.tolerance
  from public.questions q
  where q.id = p_question_id and public.can_read_solution(p_question_id)
$$;

grant execute on function public.get_question_solution(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Batch join (4.3). A join code writes a student membership + enrolment,
-- enforcing one batch per class-subject per institute. peek_join_code echoes
-- the institute name first (C2 item 7) — this is what stops a student joining
-- the wrong institute from a mistyped code.
-- ----------------------------------------------------------------------------
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
  where b.join_code = p_code and b.active = true
$$;

grant execute on function public.peek_join_code(text) to authenticated;

create or replace function public.join_batch(p_code text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  v_batch record;
  v_existing text;
begin
  select b.id, b.institute_id, b.class_subject_id
    into v_batch
  from public.batches b
  where b.join_code = p_code and b.active = true;

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

  -- A join code writes a student membership (never downgrades an existing role).
  insert into public.institute_members (institute_id, user_id, role)
  values (v_batch.institute_id, auth.uid(), 'student')
  on conflict (institute_id, user_id) do nothing;

  insert into public.enrolments (institute_id, batch_id, student_id, class_subject_id)
  values (v_batch.institute_id, v_batch.id, auth.uid(), v_batch.class_subject_id);

  return v_batch.id;
end;
$$;

grant execute on function public.join_batch(text) to authenticated;

-- ----------------------------------------------------------------------------
-- Activation decision (C2b item 4/5). Platform owner only. Writes the tenant's
-- institute_class_subjects and an audit row in one transaction.
-- ----------------------------------------------------------------------------
create or replace function public.decide_activation_request(
  p_request_id uuid,
  p_approve boolean,
  p_reason text default null
)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_inst uuid;
  v_cs uuid;
begin
  if not public.is_platform_owner() then
    raise exception 'platform owner only';
  end if;

  select institute_id, class_subject_id into v_inst, v_cs
  from public.activation_requests where id = p_request_id;
  if v_inst is null then
    raise exception 'no such activation request';
  end if;

  if p_approve then
    insert into public.institute_class_subjects
      (institute_id, class_subject_id, status, activated_at, activated_by)
    values (v_inst, v_cs, 'active', now(), auth.uid())
    on conflict (institute_id, class_subject_id)
      do update set status = 'active', activated_at = now(), activated_by = auth.uid();

    update public.activation_requests
      set status = 'approved', decided_at = now(), decided_by = auth.uid()
      where id = p_request_id;
  else
    update public.activation_requests
      set status = 'declined', reason = p_reason, decided_at = now(), decided_by = auth.uid()
      where id = p_request_id;
  end if;

  insert into public.platform_access_log (actor, institute_id, action, target_table, target_id)
  values (auth.uid(), v_inst,
          case when p_approve then 'activation_approved' else 'activation_declined' end,
          'activation_requests', p_request_id);
end;
$$;

-- ----------------------------------------------------------------------------
-- Platform inspect functions (5.8). Audited, no impersonation. Every call
-- writes a platform_access_log row. Return only the shape the console needs.
-- ----------------------------------------------------------------------------
create or replace function public.platform_inspect_institute(p_institute_id uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_platform_owner() then
    raise exception 'platform owner only';
  end if;

  insert into public.platform_access_log (actor, institute_id, action, target_table, target_id)
  values (auth.uid(), p_institute_id, 'inspect_institute', 'institutes', p_institute_id);

  select jsonb_build_object(
    'institute', (select to_jsonb(i) from public.institutes i where i.id = p_institute_id),
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', m.user_id, 'email', p.email, 'full_name', p.full_name,
        'role', m.role, 'created_at', m.created_at)), '[]'::jsonb)
      from public.institute_members m
      join public.profiles p on p.id = m.user_id
      where m.institute_id = p_institute_id
    ),
    'batches', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', b.id, 'name', b.name, 'active', b.active)), '[]'::jsonb)
      from public.batches b where b.institute_id = p_institute_id
    ),
    'recent_papers', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', pa.id, 'title', pa.title, 'generated_at', pa.generated_at)), '[]'::jsonb)
      from (
        select * from public.papers where institute_id = p_institute_id
        order by created_at desc limit 20
      ) pa
    ),
    'activation', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'class_subject_id', ics.class_subject_id, 'status', ics.status)), '[]'::jsonb)
      from public.institute_class_subjects ics where ics.institute_id = p_institute_id
    )
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.platform_inspect_paper(p_paper_id uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_inst uuid;
  v_result jsonb;
begin
  if not public.is_platform_owner() then
    raise exception 'platform owner only';
  end if;

  select institute_id into v_inst from public.papers where id = p_paper_id;

  insert into public.platform_access_log (actor, institute_id, action, target_table, target_id)
  values (auth.uid(), v_inst, 'inspect_paper', 'papers', p_paper_id);

  select jsonb_build_object(
    'paper', (select to_jsonb(p) from public.papers p where p.id = p_paper_id),
    'sets', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'set_label', s.set_label, 'copies', s.copies_to_print)), '[]'::jsonb)
      from public.paper_sets s where s.paper_id = p_paper_id
    ),
    'block_count', (select count(*) from public.paper_blocks where paper_id = p_paper_id),
    'question_count', (select count(*) from public.paper_questions where paper_id = p_paper_id)
  ) into v_result;

  return v_result;
end;
$$;

-- ============================================================================
-- POLICIES for papers/blocks/sets (deferred from 0005) and activity (0006).
-- ============================================================================

-- papers ---------------------------------------------------------------------
create policy papers_read on public.papers
  for select to authenticated
  using (public.can_access_paper(id));

create policy papers_write on public.papers
  for all to authenticated
  using (
    institute_id in (select public.my_institutes())
    and (public.my_role(institute_id) = 'institute_admin'
         or public.teaches(institute_id, class_subject_id))
  )
  with check (
    institute_id in (select public.my_institutes())
    and (public.my_role(institute_id) = 'institute_admin'
         or public.teaches(institute_id, class_subject_id))
  );

-- Child tables of a paper: read if you can access the paper; write if teacher/
-- admin of the owning institute (tenancy via institute_id predicate).
create policy paper_sections_read on public.paper_sections
  for select to authenticated using (public.can_access_paper(paper_id));
create policy paper_sections_write on public.paper_sections
  for all to authenticated
  using (institute_id in (select public.my_institutes())
         and public.my_role(institute_id) in ('teacher', 'institute_admin'))
  with check (institute_id in (select public.my_institutes())
         and public.my_role(institute_id) in ('teacher', 'institute_admin'));

create policy paper_blocks_read on public.paper_blocks
  for select to authenticated using (public.can_access_paper(paper_id));
create policy paper_blocks_write on public.paper_blocks
  for all to authenticated
  using (institute_id in (select public.my_institutes())
         and public.my_role(institute_id) in ('teacher', 'institute_admin'))
  with check (institute_id in (select public.my_institutes())
         and public.my_role(institute_id) in ('teacher', 'institute_admin'));

create policy paper_questions_read on public.paper_questions
  for select to authenticated using (public.can_access_paper(paper_id));
create policy paper_questions_write on public.paper_questions
  for all to authenticated
  using (institute_id in (select public.my_institutes())
         and public.my_role(institute_id) in ('teacher', 'institute_admin'))
  with check (institute_id in (select public.my_institutes())
         and public.my_role(institute_id) in ('teacher', 'institute_admin'));

create policy paper_sets_read on public.paper_sets
  for select to authenticated using (public.can_access_paper(paper_id));
create policy paper_sets_write on public.paper_sets
  for all to authenticated
  using (institute_id in (select public.my_institutes())
         and public.my_role(institute_id) in ('teacher', 'institute_admin'))
  with check (institute_id in (select public.my_institutes())
         and public.my_role(institute_id) in ('teacher', 'institute_admin'));

create policy paper_set_items_read on public.paper_set_items
  for select to authenticated
  using (public.can_access_paper(public.paper_of_set(paper_set_id)));
create policy paper_set_items_write on public.paper_set_items
  for all to authenticated
  using (institute_id in (select public.my_institutes())
         and public.my_role(institute_id) in ('teacher', 'institute_admin'))
  with check (institute_id in (select public.my_institutes())
         and public.my_role(institute_id) in ('teacher', 'institute_admin'));

create policy paper_set_options_read on public.paper_set_options
  for select to authenticated
  using (public.can_access_paper(public.paper_of_set(paper_set_id)));
create policy paper_set_options_write on public.paper_set_options
  for all to authenticated
  using (institute_id in (select public.my_institutes())
         and public.my_role(institute_id) in ('teacher', 'institute_admin'))
  with check (institute_id in (select public.my_institutes())
         and public.my_role(institute_id) in ('teacher', 'institute_admin'));

-- teacher_subjects -----------------------------------------------------------
create policy teacher_subjects_read on public.teacher_subjects
  for select to authenticated
  using (institute_id in (select public.my_institutes()));
create policy teacher_subjects_write on public.teacher_subjects
  for all to authenticated
  using (public.my_role(institute_id) = 'institute_admin')
  with check (public.my_role(institute_id) = 'institute_admin');

-- batches --------------------------------------------------------------------
create policy batches_read on public.batches
  for select to authenticated
  using (institute_id in (select public.my_institutes()));
create policy batches_write on public.batches
  for all to authenticated
  using (
    institute_id in (select public.my_institutes())
    and (public.my_role(institute_id) = 'institute_admin'
         or public.teaches(institute_id, class_subject_id))
  )
  with check (
    institute_id in (select public.my_institutes())
    and (public.my_role(institute_id) = 'institute_admin'
         or public.teaches(institute_id, class_subject_id))
  );

-- enrolments: read own (student) or all (teacher/admin) within institute.
-- Writes go through join_batch / support functions (definer).
create policy enrolments_read on public.enrolments
  for select to authenticated
  using (
    institute_id in (select public.my_institutes())
    and (student_id = auth.uid()
         or public.my_role(institute_id) in ('teacher', 'institute_admin'))
  );

-- attempts -------------------------------------------------------------------
create policy attempts_read on public.attempts
  for select to authenticated
  using (
    institute_id in (select public.my_institutes())
    and (student_id = auth.uid()
         or public.my_role(institute_id) in ('teacher', 'institute_admin'))
  );
create policy attempts_insert_own on public.attempts
  for insert to authenticated
  with check (
    student_id = auth.uid()
    and institute_id in (select public.my_institutes())
    and public.can_access_paper(paper_id)
  );

-- attempt_items: tenancy via institute_id; ownership via the parent attempt.
create policy attempt_items_read on public.attempt_items
  for select to authenticated
  using (
    institute_id in (select public.my_institutes())
    and exists (
      select 1 from public.attempts a
      where a.id = attempt_id
        and (a.student_id = auth.uid()
             or public.my_role(a.institute_id) in ('teacher', 'institute_admin'))
    )
  );
create policy attempt_items_insert_own on public.attempt_items
  for insert to authenticated
  with check (
    institute_id in (select public.my_institutes())
    and exists (
      select 1 from public.attempts a
      where a.id = attempt_id and a.student_id = auth.uid()
    )
  );

-- practice_sets / items: student owns their own.
create policy practice_sets_rw on public.practice_sets
  for all to authenticated
  using (institute_id in (select public.my_institutes()) and student_id = auth.uid())
  with check (institute_id in (select public.my_institutes()) and student_id = auth.uid());

create policy practice_set_items_rw on public.practice_set_items
  for all to authenticated
  using (
    institute_id in (select public.my_institutes())
    and exists (
      select 1 from public.practice_sets ps
      where ps.id = practice_set_id and ps.student_id = auth.uid()
    )
  )
  with check (
    institute_id in (select public.my_institutes())
    and exists (
      select 1 from public.practice_sets ps
      where ps.id = practice_set_id and ps.student_id = auth.uid()
    )
  );

-- question_exposure: a student reads only their own (5.7 rule 2).
create policy question_exposure_read on public.question_exposure
  for select to authenticated
  using (institute_id in (select public.my_institutes()) and student_id = auth.uid());

-- coverage_gaps: teacher/admin of the institute.
create policy coverage_gaps_read on public.coverage_gaps
  for select to authenticated
  using (public.my_role(institute_id) in ('teacher', 'institute_admin'));

-- activation_requests: institute admins read/create their own institute's.
create policy activation_requests_read on public.activation_requests
  for select to authenticated
  using (public.my_role(institute_id) = 'institute_admin');
create policy activation_requests_insert on public.activation_requests
  for insert to authenticated
  with check (
    public.my_role(institute_id) = 'institute_admin'
    and requested_by = auth.uid()
  );

-- ============================================================================
-- DOWN
-- ============================================================================
/*
-- policies
drop policy if exists activation_requests_insert on public.activation_requests;
drop policy if exists activation_requests_read on public.activation_requests;
drop policy if exists coverage_gaps_read on public.coverage_gaps;
drop policy if exists question_exposure_read on public.question_exposure;
drop policy if exists practice_set_items_rw on public.practice_set_items;
drop policy if exists practice_sets_rw on public.practice_sets;
drop policy if exists attempt_items_insert_own on public.attempt_items;
drop policy if exists attempt_items_read on public.attempt_items;
drop policy if exists attempts_insert_own on public.attempts;
drop policy if exists attempts_read on public.attempts;
drop policy if exists enrolments_read on public.enrolments;
drop policy if exists batches_write on public.batches;
drop policy if exists batches_read on public.batches;
drop policy if exists teacher_subjects_write on public.teacher_subjects;
drop policy if exists teacher_subjects_read on public.teacher_subjects;
drop policy if exists paper_set_options_write on public.paper_set_options;
drop policy if exists paper_set_options_read on public.paper_set_options;
drop policy if exists paper_set_items_write on public.paper_set_items;
drop policy if exists paper_set_items_read on public.paper_set_items;
drop policy if exists paper_sets_write on public.paper_sets;
drop policy if exists paper_sets_read on public.paper_sets;
drop policy if exists paper_questions_write on public.paper_questions;
drop policy if exists paper_questions_read on public.paper_questions;
drop policy if exists paper_blocks_write on public.paper_blocks;
drop policy if exists paper_blocks_read on public.paper_blocks;
drop policy if exists paper_sections_write on public.paper_sections;
drop policy if exists paper_sections_read on public.paper_sections;
drop policy if exists papers_write on public.papers;
drop policy if exists papers_read on public.papers;
-- functions
drop function if exists public.platform_inspect_paper(uuid);
drop function if exists public.platform_inspect_institute(uuid);
drop function if exists public.decide_activation_request(uuid, boolean, text);
drop function if exists public.join_batch(text);
drop function if exists public.peek_join_code(text);
drop function if exists public.get_question_solution(uuid);
drop function if exists public.can_read_solution(uuid);
drop function if exists public.paper_of_set(uuid);
drop function if exists public.can_access_paper(uuid);
drop function if exists public.teaches(uuid, uuid);
*/
