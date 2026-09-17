-- ============================================================================
-- 0017 · RATE LIMIT PAPER GENERATION, PER USER AND PER INSTITUTE
--
-- BUILD-PLAN C12 item 6: "Rate limiting on the generate endpoint, per
-- institute as well as per user, so one tenant cannot exhaust a shared quota."
--
-- On Vercel the app runs as many short-lived serverless instances, so an
-- in-memory counter limits nothing. The count lives in the database, next to
-- the data it protects, and is checked and recorded in one call.
--
-- Limits, per rolling ten minutes:
--                 per person   per institute
--   preview          120            600
--   save              20            100
-- The generator screen debounces its previews, so a teacher clicking
-- Regenerate every five seconds for ten minutes stays inside the preview
-- limit; a script does not. The institute limit is what stops one
-- tenant's burst from starving everyone else's.
-- ============================================================================

create table public.generation_events (
  id bigint generated always as identity primary key,
  institute_id uuid not null references public.institutes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('preview', 'save')),
  at timestamptz not null default now()
);

create index generation_events_institute_at on public.generation_events (institute_id, kind, at);
create index generation_events_user_at on public.generation_events (user_id, kind, at);

alter table public.generation_events enable row level security;

-- Written only by note_generation (definer). Institute admins can read their
-- own institute's usage; nobody writes directly.
create policy generation_events_read_admin on public.generation_events
  for select to authenticated
  using (public.my_role(institute_id) = 'institute_admin');

create or replace function public.note_generation(p_institute_id uuid, p_kind text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_user_limit int;
  v_inst_limit int;
  v_user_n int;
  v_inst_n int;
begin
  if coalesce(my_role(p_institute_id), '') not in ('teacher', 'institute_admin') then
    raise exception 'not authorised';
  end if;
  if p_kind not in ('preview', 'save') then
    raise exception 'invalid kind';
  end if;

  v_user_limit := case p_kind when 'preview' then 120 else 20 end;
  v_inst_limit := case p_kind when 'preview' then 600 else 100 end;

  -- Serialise checks per institute so concurrent requests cannot all pass a
  -- limit they jointly exceed.
  perform pg_advisory_xact_lock(hashtext('note_generation:' || p_institute_id::text));

  select count(*) into v_user_n from generation_events
  where user_id = auth.uid() and kind = p_kind and at > now() - interval '10 minutes';
  if v_user_n >= v_user_limit then
    raise exception 'rate limit: you have made % % requests in ten minutes', v_user_n, p_kind;
  end if;

  select count(*) into v_inst_n from generation_events
  where institute_id = p_institute_id and kind = p_kind and at > now() - interval '10 minutes';
  if v_inst_n >= v_inst_limit then
    raise exception 'rate limit: your institute has made % % requests in ten minutes', v_inst_n, p_kind;
  end if;

  insert into generation_events (institute_id, user_id, kind) values (p_institute_id, auth.uid(), p_kind);

  -- Keep the table small: nothing older than a day is ever read.
  delete from generation_events
  where institute_id = p_institute_id and at < now() - interval '1 day';
end;
$$;

grant execute on function public.note_generation(uuid, text) to authenticated;

-- ============================================================================
-- DOWN
-- ============================================================================
/*
drop function if exists public.note_generation(uuid, text);
drop policy if exists generation_events_read_admin on public.generation_events;
drop table if exists public.generation_events;
*/
