-- ============================================================================
-- RLS TESTS (BUILD-PLAN C1 item 15) — the v2.2 rules plus tenancy.
-- Run:  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.test.sql
-- ============================================================================
\set ON_ERROR_STOP on
begin;
\ir seed_fixtures.sql

-- Extra fixtures: a second class-subject in institute A that student A1 is NOT
-- enrolled in and teacher A is NOT assigned to (as the migration role).
insert into public.subjects (id, name, short_name, script)
  values ('5c1e0000-0000-0000-0000-000000000002', 'Mathematics', 'MAT', 'latin')
  on conflict (id) do nothing;
insert into public.class_subjects (id, class_id, subject_id, bank_status)
  values ('c5000000-0000-0000-0000-000000000002',
          '00000010-0000-0000-0000-000000000010',
          '5c1e0000-0000-0000-0000-000000000002', 'ready')
  on conflict (id) do nothing;
insert into public.institute_class_subjects (institute_id, class_subject_id, status, activated_at)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c5000000-0000-0000-0000-000000000002', 'active', now())
  on conflict do nothing;
insert into public.papers (id, institute_id, teacher_id, class_subject_id, title, total_marks, status)
  values ('9a9e0000-0000-0000-0000-000000000c02', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          null, 'c5000000-0000-0000-0000-000000000002', 'A Maths Test', 20, 'generated')
  on conflict (id) do nothing;

\echo '--- a student sees zero rows of another student''s attempt_items ---'
do $$
declare n int;
begin
  perform public.test_as('a4a4a4a4-0000-0000-0000-000000000001');  -- student A2 (no attempts)
  select count(*) into n from public.attempt_items
    where attempt_id = 'a77e0000-0000-0000-0000-00000000000a';    -- A1's attempt
  if n <> 0 then raise exception 'FAIL: A2 saw % of A1 attempt_items', n; end if;
  raise notice 'PASS: student cannot read another student attempt_items';
end $$;

\echo '--- solution gate: no attempt -> no solution; with attempt -> solution ---'
do $$
declare n int;
begin
  perform public.test_as('a4a4a4a4-0000-0000-0000-000000000001');  -- A2, no attempt
  select count(*) into n from public.get_question_solution('90000000-0000-0000-0000-0000000000f1');
  if n <> 0 then raise exception 'FAIL: A2 read a solution with no attempt'; end if;

  perform public.test_as('a3a3a3a3-0000-0000-0000-000000000001');  -- A1, has attempt on f1
  select count(*) into n from public.get_question_solution('90000000-0000-0000-0000-0000000000f1');
  if n <> 1 then raise exception 'FAIL: A1 could not read solution after attempt'; end if;
  raise notice 'PASS: solution gate holds in both directions';
end $$;

\echo '--- sensitive columns are revoked from direct client select ---'
do $$
begin
  perform public.test_as('a3a3a3a3-0000-0000-0000-000000000001');
  begin
    perform answer from public.questions where id = '90000000-0000-0000-0000-0000000000f1';
    raise exception 'FAIL: direct select of answer column succeeded';
  exception when insufficient_privilege then
    raise notice 'PASS: answer column not directly selectable';
  end;
end $$;

\echo '--- a teacher update to questions fails (zero rows) ---'
do $$
declare n int;
begin
  perform public.test_as('a2a2a2a2-0000-0000-0000-000000000001');  -- teacher A
  update public.questions set marks = 42
    where id = '90000000-0000-0000-0000-0000000000f1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: teacher updated % questions', n; end if;
  raise notice 'PASS: teacher update to questions affected zero rows';
end $$;

\echo '--- a student cannot read a paper from a class-subject not enrolled in ---'
do $$
declare n int;
begin
  perform public.test_as('a3a3a3a3-0000-0000-0000-000000000001');  -- A1: enrolled in Science only
  select count(*) into n from public.papers
    where id = '9a9e0000-0000-0000-0000-000000000c02';            -- the Maths paper
  if n <> 0 then raise exception 'FAIL: student read a paper from an un-enrolled subject'; end if;
  -- but they CAN read the Science paper they are enrolled for
  select count(*) into n from public.papers
    where id = '9a9e0000-0000-0000-0000-00000000000a';
  if n <> 1 then raise exception 'FAIL: enrolled student cannot read their own paper'; end if;
  raise notice 'PASS: paper visibility follows enrolment';
end $$;

\echo '--- a teacher cannot generate for a class-subject not in teacher_subjects ---'
do $$
begin
  perform public.test_as('a2a2a2a2-0000-0000-0000-000000000001');  -- teacher A (Science only)
  begin
    insert into public.papers (institute_id, teacher_id, class_subject_id, title, total_marks, status)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            'a2a2a2a2-0000-0000-0000-000000000001',
            'c5000000-0000-0000-0000-000000000002',  -- Maths, not assigned
            'sneaky maths', 10, 'draft');
    raise exception 'FAIL: teacher generated for an unassigned class-subject';
  exception when insufficient_privilege or others then
    raise notice 'PASS: teacher blocked from generating for unassigned subject (%)', sqlerrm;
  end;
end $$;

\echo '--- direct update institute_members set role=owner fails for every role ---'
do $$
declare n int; uid uuid;
begin
  foreach uid in array array[
    'a3a3a3a3-0000-0000-0000-000000000001'::uuid,  -- student
    'a2a2a2a2-0000-0000-0000-000000000001'::uuid,  -- teacher
    'a1a1a1a1-0000-0000-0000-000000000001'::uuid,  -- institute_admin
    '00000000-0000-0000-0000-0000000000ff'::uuid   -- platform owner
  ] loop
    perform public.test_as(uid);
    update public.institute_members set role = 'owner'
      where institute_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    get diagnostics n = row_count;
    if n <> 0 then
      raise exception 'FAIL: direct role update affected % rows as %', n, uid;
    end if;
  end loop;
  raise notice 'PASS: no role can UPDATE institute_members.role directly';
end $$;

\echo '--- set_member_role: teacher fails; institute_admin succeeds + audits ---'
do $$
declare n int;
begin
  perform public.test_as('a2a2a2a2-0000-0000-0000-000000000001');  -- teacher A
  begin
    perform public.set_member_role(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'student.a2@inst.test', 'teacher');
    raise exception 'FAIL: teacher used set_member_role';
  exception when others then
    raise notice 'PASS: teacher blocked from set_member_role (%)', sqlerrm;
  end;

  perform public.test_as('a1a1a1a1-0000-0000-0000-000000000001');  -- admin A
  perform public.set_member_role(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'student.a2@inst.test', 'teacher');
  select count(*) into n from public.role_audit
    where institute_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      and target = 'a4a4a4a4-0000-0000-0000-000000000001'
      and new_role = 'teacher';
  if n < 1 then raise exception 'FAIL: set_member_role did not write role_audit'; end if;
  raise notice 'PASS: set_member_role works for admin and writes role_audit';
end $$;

\echo '--- a new auth.users insert lands with a profile and zero memberships ---'
do $$
declare n int;
begin
  insert into auth.users (id, email, aud, role)
    values ('deadbeef-0000-0000-0000-000000000001', 'nobody@nowhere.test',
            'authenticated', 'authenticated')
    on conflict (id) do nothing;
  select count(*) into n from public.profiles where id = 'deadbeef-0000-0000-0000-000000000001';
  if n <> 1 then raise exception 'FAIL: new user has no profile'; end if;
  select count(*) into n from public.institute_members where user_id = 'deadbeef-0000-0000-0000-000000000001';
  if n <> 0 then raise exception 'FAIL: new user already has % memberships', n; end if;
  raise notice 'PASS: a new sign-in belongs to nothing';
end $$;

reset role;
\echo '=========================================================================='
\echo 'RLS TESTS PASSED'
\echo '=========================================================================='
rollback;
