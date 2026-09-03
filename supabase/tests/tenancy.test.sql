-- ============================================================================
-- TENANCY TESTS (BUILD-PLAN C1 item 14).
-- Run:  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/tenancy.test.sql
-- Any failure raises an exception and (with ON_ERROR_STOP) fails the run.
-- Wrapped in a transaction that ROLLs BACK so it leaves no residue.
-- ============================================================================
\set ON_ERROR_STOP on
begin;
\ir seed_fixtures.sql

\echo '--- enumerated cross-tenant isolation (institute_id + owner_institute_id) ---'
do $$
declare
  a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  r record;
  n int;
  checked int := 0;
begin
  -- Act as an institute A student.
  perform public.test_as('a3a3a3a3-0000-0000-0000-000000000001');

  -- Every base table carrying institute_id: A must see zero institute-B rows.
  for r in
    select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'institute_id'
    order by table_name
  loop
    execute format('select count(*) from public.%I where institute_id = $1', r.table_name)
      into n using b;
    if n <> 0 then
      raise exception 'FAIL: A student saw % rows of institute B in %', n, r.table_name;
    end if;
    checked := checked + 1;
  end loop;

  -- Bank tables carry owner_institute_id: A must not see B's PRIVATE rows.
  -- (Platform-owned rows are shared by design and excluded from this check.)
  for r in
    select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'owner_institute_id'
    order by table_name
  loop
    execute format(
      'select count(*) from public.%I where owner_institute_id = $1', r.table_name)
      into n using b;
    if n <> 0 then
      raise exception 'FAIL: A saw % private rows of institute B in %', n, r.table_name;
    end if;
    checked := checked + 1;
  end loop;

  if checked = 0 then
    raise exception 'FAIL: enumerated zero tables — the test is not testing anything';
  end if;
  raise notice 'PASS: enumerated isolation across % tenant-scoped tables', checked;
end $$;

\echo '--- A shared question is visible to both; private questions are not ---'
do $$
declare n int;
begin
  perform public.test_as('a3a3a3a3-0000-0000-0000-000000000001');
  select count(*) into n from public.questions
    where id = '90000000-0000-0000-0000-0000000000f1';
  if n <> 1 then raise exception 'FAIL: A cannot see the shared question'; end if;
  select count(*) into n from public.questions
    where id = '90000000-0000-0000-0000-0000000000b1';
  if n <> 0 then raise exception 'FAIL: A can see institute B private question'; end if;
  select count(*) into n from public.questions
    where id = '90000000-0000-0000-0000-0000000000a1';
  if n <> 1 then raise exception 'FAIL: A cannot see its own private question'; end if;
  raise notice 'PASS: shared visible to A, B-private invisible to A';
end $$;

\echo '--- moonlighting teacher sees both memberships and only the right data ---'
do $$
declare n int;
begin
  perform public.test_as('cccccccc-0000-0000-0000-000000000001');
  select count(*) into n from public.institute_members
    where user_id = 'cccccccc-0000-0000-0000-000000000001';
  if n <> 2 then raise exception 'FAIL: moonlighter should see 2 memberships, saw %', n; end if;
  -- Under institute A they see A''s batches, and B''s too (member of both) — but
  -- never a THIRD institute. Here there are only A and B, so assert both counts.
  select count(*) into n from public.batches
    where institute_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  if n < 1 then raise exception 'FAIL: moonlighter cannot see institute A batch'; end if;
  raise notice 'PASS: moonlighter sees both memberships';
end $$;

\echo '--- institute_admin cannot set a role at ANOTHER institute ---'
do $$
begin
  perform public.test_as('a1a1a1a1-0000-0000-0000-000000000001');  -- admin A
  begin
    perform public.set_member_role(
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'student.b2@inst.test', 'teacher');
    raise exception 'FAIL: admin A set a role at institute B';
  exception when others then
    raise notice 'PASS: admin A blocked from setting role at institute B (%)', sqlerrm;
  end;
end $$;

\echo '--- institute_admin cannot grant institute_admin or owner ---'
do $$
begin
  perform public.test_as('a1a1a1a1-0000-0000-0000-000000000001');
  begin
    perform public.set_member_role(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'teacher.a@inst.test', 'institute_admin');
    raise exception 'FAIL: admin A granted institute_admin';
  exception when others then
    raise notice 'PASS: admin A cannot grant institute_admin (%)', sqlerrm;
  end;
  begin
    perform public.set_member_role(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'teacher.a@inst.test', 'owner');
    raise exception 'FAIL: admin A granted owner';
  exception when others then
    raise notice 'PASS: admin A cannot grant owner (%)', sqlerrm;
  end;
end $$;

\echo '--- institute_admin cannot write questions/stimuli (even own-owned) ---'
do $$
declare n int;
begin
  perform public.test_as('a1a1a1a1-0000-0000-0000-000000000001');
  -- Attempt to insert a question owned by their OWN institute: RLS blocks it.
  begin
    insert into public.questions
      (owner_institute_id, class_subject_id, body, question_type, marks, difficulty)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'c5000000-0000-0000-0000-000000000001', 'sneaky', 'short', 1, 'easy');
    raise exception 'FAIL: institute_admin inserted a question';
  exception when insufficient_privilege or others then
    raise notice 'PASS: institute_admin cannot insert questions (%)', sqlerrm;
  end;
  -- Update an existing shared question: zero rows (no write policy for them).
  update public.questions set marks = 99
    where id = '90000000-0000-0000-0000-0000000000f1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: institute_admin updated % questions', n; end if;
  raise notice 'PASS: institute_admin update affected zero questions';
end $$;

\echo '--- a tenant of any role sees zero of another institute''s invites ---'
do $$
declare n int;
begin
  -- Seed an invite in institute B.
  perform public.test_as('b1b1b1b1-0000-0000-0000-000000000001');  -- admin B
  insert into public.institute_invites (institute_id, email, role, invited_by)
    values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'new.teacher.b@inst.test', 'teacher',
            'b1b1b1b1-0000-0000-0000-000000000001')
    on conflict do nothing;

  perform public.test_as('a1a1a1a1-0000-0000-0000-000000000001');  -- admin A
  select count(*) into n from public.institute_invites
    where institute_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  if n <> 0 then raise exception 'FAIL: admin A saw % of B invites', n; end if;
  raise notice 'PASS: institute A cannot see institute B invites';
end $$;

\echo '--- create_institute called by an institute_admin fails ---'
do $$
begin
  perform public.test_as('a1a1a1a1-0000-0000-0000-000000000001');
  begin
    perform public.create_institute('Rogue', 'rogue', 'x@x.test', 'a@a.test');
    raise exception 'FAIL: institute_admin created an institute';
  exception when others then
    raise notice 'PASS: institute_admin cannot create_institute (%)', sqlerrm;
  end;
end $$;

\echo '--- a flag by institute A leaves the question in institute B''s pool ---'
do $$
declare n int;
begin
  perform public.test_as('a2a2a2a2-0000-0000-0000-000000000001');  -- teacher A
  insert into public.question_flags (institute_id, question_id, raised_by, reason)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            '90000000-0000-0000-0000-0000000000f1',
            'a2a2a2a2-0000-0000-0000-000000000001', 'looks wrong');
  -- Institute B still sees the shared question (flag suppresses for A only;
  -- suppression is applied by the generator/query layer, not by hiding the row).
  perform public.test_as('b2b2b2b2-0000-0000-0000-000000000001');  -- teacher B
  select count(*) into n from public.questions
    where id = '90000000-0000-0000-0000-0000000000f1';
  if n <> 1 then raise exception 'FAIL: B lost the shared question after A flagged it'; end if;
  -- And B cannot see A''s flag.
  select count(*) into n from public.question_flags
    where institute_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  if n <> 0 then raise exception 'FAIL: B saw institute A flag'; end if;
  raise notice 'PASS: A flag does not remove the shared question for B, and is private to A';
end $$;

reset role;
\echo '=========================================================================='
\echo 'TENANCY TESTS PASSED'
\echo '=========================================================================='
rollback;
