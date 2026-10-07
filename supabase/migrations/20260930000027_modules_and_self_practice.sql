-- ============================================================================
-- Modules per institute, and students building their own practice sets.
--
-- 1. institutes.modules: the platform owner's per-institute switches, stored as
--    only the keys that differ from the default. module_enabled() applies the
--    defaults (all on except self_practice) and the dependencies (results and
--    self_practice need student_app); src/lib/modules.ts mirrors it.
--    Enforced here where it matters for access:
--      * student_app off: join codes refuse, papers never reach students;
--      * teachers off: no teacher invites (and no teacher approvals, in the app);
--      * student_app off: no student invites;
--      * self_practice off: create_self_practice refuses.
--    platform_set_modules() is the owner's way to change them, and logs it.
--
-- 2. Self-practice: create_self_practice() builds a set from the shared bank and
--    the institute's own questions for a subject the student takes, chosen
--    chapters, a count and a difficulty, optionally weak topics first, unseen
--    questions first. practice_sets gains source ('mistakes' | 'self') and title.
--
-- 3. Closes a hole: practice_set_items allowed students to INSERT any
--    question into their own set, and can_read_solution() then released its
--    answer and solution (any question, even another institute's private one,
--    or one on a paper they have not sat). Items and sets are now written only
--    by the definer functions; students may still mark items done.
-- ============================================================================

-- ---- modules ----------------------------------------------------------------
alter table public.institutes add column if not exists modules jsonb not null default '{}'::jsonb;

create or replace function public.module_enabled(p_institute_id uuid, p_module text)
returns boolean language sql stable security definer set search_path = public
as $$
  with m as (select coalesce(modules, '{}'::jsonb) as v from public.institutes where id = p_institute_id),
  raw as (
    select
      coalesce((select (v ->> 'student_app')::boolean from m), true) as student_app,
      coalesce((select (v ->> 'results')::boolean from m), true) as results,
      coalesce((select (v ->> 'teachers')::boolean from m), true) as teachers,
      coalesce((select (v ->> 'self_practice')::boolean from m), false) as self_practice
  )
  select case p_module
    when 'student_app' then student_app
    when 'teachers' then teachers
    when 'results' then student_app and results
    when 'self_practice' then student_app and self_practice
    else false
  end
  from raw
$$;
grant execute on function public.module_enabled(uuid, text) to authenticated;

create or replace function public.platform_set_modules(p_institute_id uuid, p_modules jsonb)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_clean jsonb := '{}'::jsonb;
  v_key text;
begin
  perform platform_guard();
  if not exists (select 1 from institutes where id = p_institute_id and kind = 'institute') then
    raise exception 'institute not found';
  end if;
  foreach v_key in array array['student_app', 'results', 'teachers', 'self_practice'] loop
    if p_modules ? v_key and jsonb_typeof(p_modules -> v_key) = 'boolean' then
      v_clean := v_clean || jsonb_build_object(v_key, p_modules -> v_key);
    end if;
  end loop;
  update institutes set modules = v_clean where id = p_institute_id;
  insert into platform_access_log (actor, institute_id, action, target_table, target_id, detail)
  values (auth.uid(), p_institute_id, 'set_modules', 'institutes', p_institute_id, v_clean::text);
end;
$$;
grant execute on function public.platform_set_modules(uuid, jsonb) to authenticated;

-- invites: a role only while its module is on
drop policy if exists institute_invites_insert_admin on public.institute_invites;
create policy institute_invites_insert_admin on public.institute_invites
  for insert to authenticated
  with check (
    public.my_role(institute_id) = 'institute_admin'
    and (
      (role = 'teacher' and public.module_enabled(institute_id, 'teachers'))
      or (role = 'student' and public.module_enabled(institute_id, 'student_app'))
    )
  );

-- joining with a code needs the student app
create or replace function public.join_batch(p_code text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  v_batch record;
begin
  select b.id, b.institute_id, b.name
    into v_batch
  from public.batches b
  join public.institutes i on i.id = b.institute_id
  where b.join_code = p_code and b.active = true and i.status = 'active';

  -- an institute without the student app answers like an unknown code
  if v_batch.id is null or not public.module_enabled(v_batch.institute_id, 'student_app') then
    raise exception 'invalid or inactive join code';
  end if;

  if exists (
    select 1 from public.enrolments e
    where e.student_id = auth.uid() and e.institute_id = v_batch.institute_id and e.batch_id = v_batch.id
  ) then
    raise exception 'already in batch "%"', v_batch.name;
  end if;

  insert into public.institute_members (institute_id, user_id, role)
  values (v_batch.institute_id, auth.uid(), 'student')
  on conflict (institute_id, user_id) do nothing;

  insert into public.enrolments (institute_id, batch_id, student_id)
  values (v_batch.institute_id, v_batch.id, auth.uid());

  return v_batch.id;
end;
$$;

-- papers reach students only while the student app is on
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
        or (
          p.released_at is not null
          and public.module_enabled(p.institute_id, 'student_app')
          and (
            (p.batch_id is not null and exists (
              select 1 from public.enrolments e
              where e.student_id = auth.uid() and e.institute_id = p.institute_id and e.batch_id = p.batch_id
            ))
            or (p.batch_id is null and exists (
              select 1 from public.enrolments e
              join public.batch_subjects bs on bs.batch_id = e.batch_id
              where e.student_id = auth.uid() and e.institute_id = p.institute_id
                and bs.class_subject_id = p.class_subject_id
            ))
            or exists (
              select 1 from public.attempts a
              where a.paper_id = p.id and a.institute_id = p.institute_id and a.student_id = auth.uid()
            )
          )
        )
      )
  )
$$;

-- ---- practice: written only by definer functions -----------------------------
alter table public.practice_sets add column if not exists source text not null default 'mistakes';
alter table public.practice_sets add column if not exists title text;
alter table public.practice_sets drop constraint if exists practice_sets_source_check;
alter table public.practice_sets add constraint practice_sets_source_check check (source in ('mistakes', 'self'));

drop policy if exists practice_sets_rw on public.practice_sets;
create policy practice_sets_read on public.practice_sets
  for select to authenticated
  using (institute_id in (select public.my_institutes()) and student_id = auth.uid());
create policy practice_sets_update on public.practice_sets
  for update to authenticated
  using (institute_id in (select public.my_institutes()) and student_id = auth.uid())
  with check (institute_id in (select public.my_institutes()) and student_id = auth.uid());
create policy practice_sets_delete on public.practice_sets
  for delete to authenticated
  using (institute_id in (select public.my_institutes()) and student_id = auth.uid());
revoke update on public.practice_sets from authenticated;
grant update (status) on public.practice_sets to authenticated;

drop policy if exists practice_set_items_rw on public.practice_set_items;
create policy practice_set_items_read on public.practice_set_items
  for select to authenticated
  using (
    institute_id in (select public.my_institutes())
    and exists (select 1 from public.practice_sets ps where ps.id = practice_set_id and ps.student_id = auth.uid())
  );
create policy practice_set_items_update on public.practice_set_items
  for update to authenticated
  using (
    institute_id in (select public.my_institutes())
    and exists (select 1 from public.practice_sets ps where ps.id = practice_set_id and ps.student_id = auth.uid())
  )
  with check (
    institute_id in (select public.my_institutes())
    and exists (select 1 from public.practice_sets ps where ps.id = practice_set_id and ps.student_id = auth.uid())
  );
revoke insert, update on public.practice_set_items from authenticated;
grant update (is_done, self_marked_correct) on public.practice_set_items to authenticated;

-- ---- self-practice -------------------------------------------------------------
create or replace function public.create_self_practice(
  p_class_subject_id uuid,
  p_chapter_ids uuid[],
  p_count int,
  p_difficulty text,
  p_weak_first boolean
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  v_inst uuid;
  v_set uuid;
  v_n int;
  v_today int;
begin
  -- the institute where this student takes this subject
  select e.institute_id into v_inst
  from enrolments e
  join batch_subjects bs on bs.batch_id = e.batch_id and bs.institute_id = e.institute_id
  where e.student_id = auth.uid() and bs.class_subject_id = p_class_subject_id
    and e.institute_id in (select my_institutes())
  limit 1;
  if v_inst is null then
    raise exception 'you are not taking this subject';
  end if;
  if not module_enabled(v_inst, 'self_practice') then
    raise exception 'self-practice is not switched on for your institute';
  end if;
  if p_count is null or p_count < 3 or p_count > 30 then
    raise exception 'choose between 3 and 30 questions';
  end if;
  if coalesce(p_difficulty, '') not in ('mixed', 'easy', 'medium', 'hard') then
    raise exception 'unknown difficulty';
  end if;
  select count(*) into v_today from practice_sets
  where student_id = auth.uid() and institute_id = v_inst and source = 'self' and built_at > now() - interval '1 day';
  if v_today >= 20 then
    raise exception 'you have made 20 practice sets today; try again tomorrow';
  end if;

  insert into practice_sets (institute_id, student_id, class_subject_id, status, source)
  values (v_inst, auth.uid(), p_class_subject_id, 'active', 'self')
  returning id into v_set;

  with weak_topics as (
    select distinct q2.topic_id
    from attempt_items ai
    join attempts a on a.id = ai.attempt_id and a.institute_id = ai.institute_id
    join questions q2 on q2.id = ai.question_id
    where a.student_id = auth.uid() and a.institute_id = v_inst and not ai.is_correct and q2.topic_id is not null
  ),
  pool as (
    select q.id,
      exists (select 1 from question_exposure x where x.institute_id = v_inst and x.student_id = auth.uid() and x.question_id = q.id) as seen,
      (q.topic_id in (select topic_id from weak_topics)) as weak
    from questions q
    where q.status = 'approved'
      and q.class_subject_id = p_class_subject_id
      and q.owner_institute_id in (platform_institute_id(), v_inst)
      and q.parent_question_id is null
      and q.stimulus_id is null
      and q.question_type in ('mcq', 'assertion_reason', 'vsa', 'sa', 'la')
      and (p_chapter_ids is null or cardinality(p_chapter_ids) = 0 or q.chapter_id = any (p_chapter_ids))
      and (p_difficulty = 'mixed' or q.difficulty = p_difficulty)
      and not exists (
        select 1 from question_flags f
        where f.question_id = q.id and f.institute_id = v_inst and f.status = 'open'
      )
  ),
  picked as (
    select id, row_number() over (
      order by (case when coalesce(p_weak_first, false) and weak then 0 else 1 end), seen, random()
    ) as rn
    from pool
  )
  insert into practice_set_items (institute_id, practice_set_id, question_id, position)
  select v_inst, v_set, id, rn from picked where rn <= p_count;
  get diagnostics v_n = row_count;

  if v_n = 0 then
    raise exception 'no questions match; choose more chapters or another difficulty';
  end if;

  update practice_sets set title = format('Own practice · %s question%s', v_n, case when v_n = 1 then '' else 's' end)
  where id = v_set;

  insert into question_exposure (institute_id, student_id, question_id, context)
  select v_inst, auth.uid(), psi.question_id, 'practice'
  from practice_set_items psi where psi.practice_set_id = v_set
  on conflict (institute_id, student_id, question_id) do nothing;

  return v_set;
end;
$$;
grant execute on function public.create_self_practice(uuid, uuid[], int, text, boolean) to authenticated;

-- ============================================================================
-- DOWN (manual): drop create_self_practice, platform_set_modules,
--   module_enabled; restore practice_sets_rw / practice_set_items_rw (0008),
--   the invite policy (0001), join_batch and can_access_paper (0025);
--   drop practice_sets.source/title and institutes.modules.
-- ============================================================================
