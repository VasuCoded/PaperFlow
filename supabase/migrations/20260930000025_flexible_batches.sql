-- ============================================================================
-- Flexible batches.
--
-- A batch used to be one class-subject, and a student could be in only one
-- batch per subject, so a coaching batch that studies Maths and Science had to
-- be created twice. Now a batch is a group of students with ANY number of
-- subjects (batch_subjects), each optionally with its own teacher, and a free
-- note (timing, room). A student may be in several batches (a regular batch
-- and a crash course that share a subject).
--
-- What a student sees:
--   * their subjects are the subjects of the batches they are in;
--   * a paper set for a batch is visible (once released) to that batch's
--     students; a paper set without a batch to every student taking its
--     subject at the institute; a paper a student already logged stays visible
--     to them even if they later move batch.
--
-- Who manages a batch: an institute admin; or a teacher who created it or
-- teaches one of its subjects. A teacher may only add subjects they teach.
-- Students join with the code, or a teacher/admin adds them from the
-- institute's students (batch_add_students / batch_remove_student).
--
-- Compatible with the app version before this one: batches.class_subject_id
-- stays (now optional) and a trigger mirrors it into batch_subjects, and
-- peek_join_code keeps its columns (subject_name now lists every subject).
-- ============================================================================

-- ---- batch_subjects ---------------------------------------------------------
create table public.batch_subjects (
  institute_id uuid not null references public.institutes (id) on delete cascade,
  batch_id uuid not null,
  class_subject_id uuid not null references public.class_subjects (id) on delete cascade,
  teacher_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (batch_id, class_subject_id),
  foreign key (batch_id, institute_id) references public.batches (id, institute_id) on delete cascade
);
create index batch_subjects_cs_idx on public.batch_subjects (institute_id, class_subject_id);
alter table public.batch_subjects enable row level security;

insert into public.batch_subjects (institute_id, batch_id, class_subject_id, teacher_id)
select b.institute_id, b.id, b.class_subject_id, b.teacher_id
from public.batches b
where b.class_subject_id is not null
on conflict do nothing;

alter table public.batches alter column class_subject_id drop not null;
alter table public.batches add column if not exists note text;

-- a batch created the old way (with class_subject_id) gets that subject
create or replace function public.batches_sync_subject()
returns trigger language plpgsql set search_path = public
as $$
begin
  if new.class_subject_id is not null then
    insert into batch_subjects (institute_id, batch_id, class_subject_id, teacher_id)
    values (new.institute_id, new.id, new.class_subject_id, new.teacher_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger batches_sync_subject
  after insert or update of class_subject_id on public.batches
  for each row execute function public.batches_sync_subject();

-- ---- enrolments: one row per (batch, student) ------------------------------
alter table public.enrolments drop constraint if exists enrolments_institute_id_student_id_class_subject_id_key;
alter table public.enrolments alter column class_subject_id drop not null;
create index if not exists enrolments_student_idx on public.enrolments (institute_id, student_id);

-- ---- who manages a batch ----------------------------------------------------
create or replace function public.teaches_in_batch(p_batch_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.batches b
    where b.id = p_batch_id
      and b.institute_id in (select public.my_institutes())
      and (
        b.teacher_id = auth.uid()
        or exists (
          select 1 from public.batch_subjects bs
          where bs.batch_id = b.id and public.teaches(b.institute_id, bs.class_subject_id)
        )
      )
  )
$$;
grant execute on function public.teaches_in_batch(uuid) to authenticated;

drop policy if exists batches_write on public.batches;
create policy batches_write on public.batches
  for all to authenticated
  using (
    institute_id in (select public.my_institutes())
    and (
      public.my_role(institute_id) = 'institute_admin'
      or (public.my_role(institute_id) = 'teacher' and (teacher_id = auth.uid() or public.teaches_in_batch(id)))
    )
  )
  with check (
    institute_id in (select public.my_institutes())
    and (
      public.my_role(institute_id) = 'institute_admin'
      or (public.my_role(institute_id) = 'teacher' and (teacher_id = auth.uid() or public.teaches_in_batch(id)))
    )
  );

create policy batch_subjects_read on public.batch_subjects
  for select to authenticated
  using (institute_id in (select public.my_institutes()));

create policy batch_subjects_write on public.batch_subjects
  for all to authenticated
  using (
    institute_id in (select public.my_institutes())
    and (
      public.my_role(institute_id) = 'institute_admin'
      or (public.my_role(institute_id) = 'teacher' and public.teaches(institute_id, class_subject_id) and public.teaches_in_batch(batch_id))
    )
  )
  with check (
    institute_id in (select public.my_institutes())
    and (
      public.my_role(institute_id) = 'institute_admin'
      or (
        public.my_role(institute_id) = 'teacher'
        and public.teaches(institute_id, class_subject_id)
        and exists (
          select 1 from public.batches b
          where b.id = batch_id and b.institute_id = batch_subjects.institute_id
            and (b.teacher_id = auth.uid() or public.teaches_in_batch(b.id))
        )
      )
    )
  );

-- ---- adding and removing students ------------------------------------------
create or replace function public.batch_add_students(p_batch_id uuid, p_student_ids uuid[])
returns int language plpgsql security definer set search_path = public
as $$
declare
  v_inst uuid;
  v_n int;
begin
  select institute_id into v_inst from batches where id = p_batch_id;
  if v_inst is null then
    raise exception 'batch not found';
  end if;
  if not (coalesce(my_role(v_inst), '') = 'institute_admin' or teaches_in_batch(p_batch_id)) then
    raise exception 'not authorised for this batch';
  end if;
  insert into enrolments (institute_id, batch_id, student_id)
  select v_inst, p_batch_id, m.user_id
  from institute_members m
  where m.institute_id = v_inst and m.role = 'student' and m.user_id = any (p_student_ids)
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
grant execute on function public.batch_add_students(uuid, uuid[]) to authenticated;

create or replace function public.batch_remove_student(p_batch_id uuid, p_student_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_inst uuid;
begin
  select institute_id into v_inst from batches where id = p_batch_id;
  if v_inst is null then
    raise exception 'batch not found';
  end if;
  if not (coalesce(my_role(v_inst), '') = 'institute_admin' or teaches_in_batch(p_batch_id)) then
    raise exception 'not authorised for this batch';
  end if;
  delete from enrolments where institute_id = v_inst and batch_id = p_batch_id and student_id = p_student_id;
end;
$$;
grant execute on function public.batch_remove_student(uuid, uuid) to authenticated;

-- ---- joining with a code -----------------------------------------------------
create or replace function public.join_batch(p_code text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  v_batch record;
begin
  -- A suspended institute's codes behave exactly like an unknown code: the
  -- message must not confirm that the institute exists.
  select b.id, b.institute_id, b.name
    into v_batch
  from public.batches b
  join public.institutes i on i.id = b.institute_id
  where b.join_code = p_code and b.active = true and i.status = 'active';

  if v_batch.id is null then
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

-- same columns as before; subject_name and class_name now list every subject
create or replace function public.peek_join_code(p_code text)
returns table (batch_id uuid, batch_name text, institute_id uuid, institute_name text,
               class_subject_id uuid, subject_name text, class_name text, already_enrolled_batch text)
language sql stable security definer set search_path = public
as $$
  select
    b.id, b.name, b.institute_id, ins.name,
    (select bs.class_subject_id from public.batch_subjects bs where bs.batch_id = b.id order by bs.created_at limit 1),
    coalesce((
      select string_agg(s.name, ', ' order by s.name)
      from public.batch_subjects bs
      join public.class_subjects cs on cs.id = bs.class_subject_id
      join public.subjects s on s.id = cs.subject_id
      where bs.batch_id = b.id
    ), 'no subjects yet'),
    coalesce((
      select string_agg(distinct cl.name, ', ')
      from public.batch_subjects bs
      join public.class_subjects cs on cs.id = bs.class_subject_id
      join public.classes cl on cl.id = cs.class_id
      where bs.batch_id = b.id
    ), ''),
    (
      select b.name from public.enrolments e
      where e.student_id = auth.uid() and e.institute_id = b.institute_id and e.batch_id = b.id
      limit 1
    )
  from public.batches b
  join public.institutes ins on ins.id = b.institute_id
  where b.join_code = p_code and b.active = true and ins.status = 'active'
$$;

create or replace function public.rotate_join_code(p_batch_id uuid)
returns text language plpgsql security definer set search_path = public
as $$
declare
  v_inst uuid;
  v_code text;
begin
  select institute_id into v_inst from batches where id = p_batch_id;
  if v_inst is null then
    raise exception 'batch not found';
  end if;
  if not (coalesce(my_role(v_inst), '') = 'institute_admin' or teaches_in_batch(p_batch_id)) then
    raise exception 'not authorised for this batch';
  end if;
  v_code := generate_join_code();
  update batches set join_code = v_code where id = p_batch_id and institute_id = v_inst;
  return v_code;
end;
$$;

-- ---- who sees a paper -------------------------------------------------------
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
            -- what they already logged stays theirs, whatever batch they are in now
            or exists (
              select 1 from public.attempts a
              where a.paper_id = p.id and a.institute_id = p.institute_id and a.student_id = auth.uid()
            )
          )
        )
      )
  )
$$;

-- ---- platform support: moving a student -------------------------------------
create or replace function public.platform_move_student(p_institute_id uuid, p_student_id uuid, p_to_batch_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_reason text;
  v_to record;
  v_from text;
begin
  perform platform_guard();
  v_reason := platform_require_reason(p_reason);

  select id, name into v_to
  from batches
  where id = p_to_batch_id and institute_id = p_institute_id and active;
  if v_to.id is null then
    raise exception 'that batch is not an open batch of this institute';
  end if;

  if exists (select 1 from enrolments where institute_id = p_institute_id and student_id = p_student_id and batch_id = p_to_batch_id) then
    raise exception 'the student is already in that batch';
  end if;

  -- the batches they leave: the ones that share a subject with the new batch
  select string_agg(b.name, ', ' order by b.name) into v_from
  from enrolments e join batches b on b.id = e.batch_id and b.institute_id = e.institute_id
  where e.institute_id = p_institute_id and e.student_id = p_student_id
    and exists (
      select 1 from batch_subjects x join batch_subjects y on y.class_subject_id = x.class_subject_id
      where x.batch_id = e.batch_id and y.batch_id = p_to_batch_id
    );
  if v_from is null then
    raise exception 'the student is not enrolled in that subject at this institute';
  end if;

  delete from enrolments e
  where e.institute_id = p_institute_id and e.student_id = p_student_id
    and exists (
      select 1 from batch_subjects x join batch_subjects y on y.class_subject_id = x.class_subject_id
      where x.batch_id = e.batch_id and y.batch_id = p_to_batch_id
    );
  insert into enrolments (institute_id, batch_id, student_id) values (p_institute_id, p_to_batch_id, p_student_id);

  insert into platform_access_log (actor, institute_id, action, target_table, target_id, detail)
  values (auth.uid(), p_institute_id, 'move_student', 'enrolments', p_student_id,
          format('%s → %s: %s', v_from, v_to.name, v_reason));
end;
$$;

-- ---- platform support: the lookup lists each batch with all its subjects ----
create or replace function public.platform_support_lookup(p_email text)
returns jsonb
language plpgsql security definer set search_path = public
as $fn$
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
        'class_subject_id', e.class_subject_id,
        'label', coalesce((
          select string_agg(class_subject_label(bs.class_subject_id), ', ' order by class_subject_label(bs.class_subject_id))
          from batch_subjects bs where bs.batch_id = e.batch_id), 'No subjects'),
        'other_batches', coalesce((
          select jsonb_agg(jsonb_build_object('id', b2.id, 'name', b2.name) order by b2.name)
          from batches b2
          where b2.institute_id = e.institute_id and b2.id <> e.batch_id and b2.active
            and exists (
              select 1 from batch_subjects x join batch_subjects y on y.class_subject_id = x.class_subject_id
              where x.batch_id = b2.id and y.batch_id = e.batch_id)), '[]'::jsonb)
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
$fn$;

-- ============================================================================
-- DOWN (manual): restore functions from 0008/0012/0016/0023, re-add
--   enrolments unique (institute_id, student_id, class_subject_id) after
--   de-duplicating, make class_subject_id not null again, drop batch_subjects.
-- ============================================================================
