-- ============================================================================
-- 0021 · PAPER CODES
--
-- Every saved paper gets a short, readable, unique code that is printed on
-- every page, so a sheet on a desk can be traced without opening the app:
--
--     SSA-10SCI-260922-03
--     │   │     │      └ the institute's 3rd paper that day
--     │   │     └ date (IST, yymmdd)
--     │   └ class 10, subject short name
--     └ institute code (initials of its name; unique)
--
-- Codes are assigned by the database on insert and can never be changed or
-- supplied by a client: a code on paper must always mean the same paper.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Institute codes
-- ----------------------------------------------------------------------------
alter table public.institutes add column if not exists code text;

-- Initials of up to four words, or the first three letters of a one-word name.
create or replace function public.institute_code_base(p_name text)
returns text language plpgsql immutable set search_path = public
as $$
declare
  v_words text[];
  v_code text := '';
begin
  v_words := array_remove(
    regexp_split_to_array(upper(regexp_replace(coalesce(p_name, ''), '[^A-Za-z0-9]+', ' ', 'g')), ' '),
    ''
  );
  if coalesce(array_length(v_words, 1), 0) >= 2 then
    for i in 1 .. least(array_length(v_words, 1), 4) loop
      v_code := v_code || left(v_words[i], 1);
    end loop;
  elsif coalesce(array_length(v_words, 1), 0) = 1 then
    v_code := left(v_words[1], 3);
  end if;
  -- rpad also truncates, so only pad what is too short
  return case when length(v_code) < 2 then rpad(v_code, 2, 'X') else v_code end;
end;
$$;

-- The base, with a number appended until it is unused.
create or replace function public.next_institute_code(p_name text, p_id uuid)
returns text language plpgsql volatile security definer set search_path = public
as $$
declare
  v_base text := public.institute_code_base(p_name);
  v_try text := v_base;
  v_n int := 1;
begin
  perform pg_advisory_xact_lock(hashtext('institute_code'));
  while exists (select 1 from public.institutes where code = v_try and id is distinct from p_id) loop
    v_n := v_n + 1;
    v_try := v_base || v_n;
  end loop;
  return v_try;
end;
$$;

do $$
declare r record;
begin
  for r in select id, name from public.institutes where code is null order by created_at, id loop
    update public.institutes set code = public.next_institute_code(r.name, r.id) where id = r.id;
  end loop;
end $$;

-- the trigger always sets it; the default only keeps it optional for inserts
alter table public.institutes alter column code set default '';
alter table public.institutes alter column code set not null;
alter table public.institutes add constraint institutes_code_format check (code ~ '^[A-Z0-9]{2,8}$');
alter table public.institutes add constraint institutes_code_key unique (code);

create or replace function public.institutes_assign_code()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.code := public.next_institute_code(new.name, new.id);
  else
    -- printed on every paper the institute ever made; renaming keeps the code
    new.code := old.code;
  end if;
  return new;
end;
$$;

create trigger institutes_assign_code_biu
  before insert or update of code on public.institutes
  for each row execute function public.institutes_assign_code();

-- ----------------------------------------------------------------------------
-- Paper codes
-- ----------------------------------------------------------------------------
alter table public.papers add column if not exists code text;

-- Definer: the running number must count EVERY paper of the institute that
-- day, not only the ones the inserting teacher can see under RLS.
create or replace function public.next_paper_code(p_institute_id uuid, p_class_subject_id uuid, p_at timestamptz)
returns text language plpgsql volatile security definer set search_path = public
as $$
declare
  v_inst text;
  v_cls text;
  v_subj text;
  v_day text := to_char((p_at at time zone 'Asia/Kolkata')::date, 'YYMMDD');
  v_n int;
begin
  select code into v_inst from public.institutes where id = p_institute_id;
  select regexp_replace(upper(c.name), '[^A-Z0-9]', '', 'g'),
         regexp_replace(upper(coalesce(nullif(s.short_name, ''), left(s.name, 3))), '[^A-Z0-9]', '', 'g')
    into v_cls, v_subj
  from public.class_subjects cs
  join public.classes c on c.id = cs.class_id
  join public.subjects s on s.id = cs.subject_id
  where cs.id = p_class_subject_id;
  if coalesce(v_subj, '') = '' then v_subj := 'SUB'; end if;

  -- one institute's papers are numbered one at a time
  perform pg_advisory_xact_lock(hashtext('paper_code:' || p_institute_id::text));
  select coalesce(max(split_part(code, '-', 4)::int), 0) + 1 into v_n
  from public.papers
  where institute_id = p_institute_id and split_part(code, '-', 3) = v_day;

  return coalesce(v_inst, 'XX') || '-' || coalesce(v_cls, '') || v_subj || '-' || v_day || '-' || lpad(v_n::text, 2, '0');
end;
$$;

do $$
declare r record;
begin
  for r in select id, institute_id, class_subject_id, created_at from public.papers where code is null order by created_at, id loop
    update public.papers set code = public.next_paper_code(r.institute_id, r.class_subject_id, r.created_at) where id = r.id;
  end loop;
end $$;

alter table public.papers alter column code set default '';
alter table public.papers alter column code set not null;
alter table public.papers add constraint papers_code_key unique (code);

create or replace function public.papers_assign_code()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    -- whatever a client sent is ignored
    new.code := public.next_paper_code(new.institute_id, new.class_subject_id, coalesce(new.created_at, now()));
  else
    new.code := old.code;
  end if;
  return new;
end;
$$;

create trigger papers_assign_code_biu
  before insert or update of code on public.papers
  for each row execute function public.papers_assign_code();

revoke execute on function public.next_institute_code(text, uuid) from public, anon, authenticated;
revoke execute on function public.next_paper_code(uuid, uuid, timestamptz) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Down:
-- drop trigger if exists papers_assign_code_biu on public.papers;
-- drop function if exists public.papers_assign_code();
-- drop function if exists public.next_paper_code(uuid, uuid, timestamptz);
-- alter table public.papers drop constraint if exists papers_code_key;
-- alter table public.papers drop column if exists code;
-- drop trigger if exists institutes_assign_code_biu on public.institutes;
-- drop function if exists public.institutes_assign_code();
-- drop function if exists public.next_institute_code(text, uuid);
-- drop function if exists public.institute_code_base(text);
-- alter table public.institutes drop constraint if exists institutes_code_key;
-- alter table public.institutes drop constraint if exists institutes_code_format;
-- alter table public.institutes drop column if exists code;
-- ----------------------------------------------------------------------------
