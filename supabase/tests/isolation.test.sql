-- ============================================================================
-- CROSS-TENANT ISOLATION SUITE (BUILD-PLAN C12 item 7).
-- The single most important test in the codebase. Enumerates every base table
-- with an institute_id and asserts, as each of student / teacher /
-- institute_admin in institute A, that:
--   * SELECT sees zero rows of institute B
--   * UPDATE against institute B rows affects zero rows
--   * DELETE against institute B rows affects zero rows
-- A new tenant-scoped table added without correct RLS fails here.
-- Run:  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/isolation.test.sql
-- ============================================================================
\set ON_ERROR_STOP on
begin;
\ir seed_fixtures.sql

do $$
declare
  b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  roles uuid[] := array[
    'a3a3a3a3-0000-0000-0000-000000000001'::uuid,  -- student A
    'a2a2a2a2-0000-0000-0000-000000000001'::uuid,  -- teacher A
    'a1a1a1a1-0000-0000-0000-000000000001'::uuid   -- institute_admin A
  ];
  role_names text[] := array['student', 'teacher', 'institute_admin'];
  uid uuid;
  r record;
  n int;
  i int;
  tables_checked int := 0;
begin
  for i in 1 .. array_length(roles, 1) loop
    uid := roles[i];
    perform public.test_as(uid);

    for r in
      select c.table_name
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema and t.table_name = c.table_name
      where c.table_schema = 'public'
        and c.column_name = 'institute_id'
        and t.table_type = 'BASE TABLE'
      order by c.table_name
    loop
      -- SELECT
      execute format('select count(*) from public.%I where institute_id = $1', r.table_name)
        into n using b;
      if n <> 0 then
        raise exception 'FAIL[%]: SELECT saw % B-rows in %', role_names[i], n, r.table_name;
      end if;

      -- UPDATE (no-op set, RLS must filter to zero rows)
      execute format(
        'update public.%I set institute_id = institute_id where institute_id = $1', r.table_name)
        using b;
      get diagnostics n = row_count;
      if n <> 0 then
        raise exception 'FAIL[%]: UPDATE hit % B-rows in %', role_names[i], n, r.table_name;
      end if;

      -- DELETE
      execute format('delete from public.%I where institute_id = $1', r.table_name)
        using b;
      get diagnostics n = row_count;
      if n <> 0 then
        raise exception 'FAIL[%]: DELETE hit % B-rows in %', role_names[i], n, r.table_name;
      end if;

      tables_checked := tables_checked + 1;
    end loop;
  end loop;

  if tables_checked = 0 then
    raise exception 'FAIL: enumerated zero tables — the suite is not testing anything';
  end if;
  raise notice 'PASS: isolation verified across % (table x role) checks', tables_checked;
end $$;

reset role;
\echo '=========================================================================='
\echo 'CROSS-TENANT ISOLATION SUITE PASSED'
\echo '=========================================================================='
rollback;
