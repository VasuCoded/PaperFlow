-- ============================================================================
-- 0019 · USERNAME ACCOUNTS AND THE ACCESS-REQUEST QUEUE
--
-- Decision (platform owner, 21 Sep 2026): sign-in is username + password, so
-- institutes can start without configuring Google. Google sign-in stays in the
-- code behind a flag.
--
-- Supabase password sign-in needs an email, so a username account carries a
-- synthetic address, <username>@users.paperflow.invalid (the .invalid TLD is
-- reserved and can never receive mail). profiles.username is the name people
-- see and type.
--
-- The rule that makes this safe is unchanged: an account grants nothing. A
-- new user belongs to no institute until
--   * they enter a batch join code (the teacher's approval), or
--   * they accept an invitation (matched on their address), or
--   * an ACCESS REQUEST they raised is approved here.
-- The requester never picks a role (CLAUDE.md: no role field, no "I am a
-- teacher"): they name an institute and write a note; the approver chooses
-- the role. Institute admins approve teachers and students of their own
-- institute; only the platform owner can make an institute admin.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Usernames
-- ----------------------------------------------------------------------------
alter table public.profiles add column if not exists username citext;

alter table public.profiles
  add constraint profiles_username_format
  check (username is null or username::text ~ '^[a-z0-9][a-z0-9._]{1,28}[a-z0-9]$');

create unique index if not exists profiles_username_key on public.profiles (username) where username is not null;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, username)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    nullif(lower(new.raw_user_meta_data ->> 'username'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Invitations may only be accepted from a CONFIRMED address. With password
-- sign-up enabled, anyone can register any address through the public API;
-- Supabase refuses such an account a session until it is confirmed, and this
-- makes the invitation check say the same thing on its own.
-- ----------------------------------------------------------------------------
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
  select email into v_email from auth.users
  where id = auth.uid() and email_confirmed_at is not null;
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

-- ----------------------------------------------------------------------------
-- Access requests
-- ----------------------------------------------------------------------------
create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  note text check (note is null or length(note) <= 500),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined', 'withdrawn')),
  granted_role text check (granted_role in ('institute_admin', 'teacher', 'student')),
  reason text,
  decided_by uuid references auth.users (id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index access_requests_one_pending
  on public.access_requests (institute_id, user_id) where status = 'pending';
create index access_requests_by_institute on public.access_requests (institute_id, status, created_at);
create index access_requests_by_user on public.access_requests (user_id, created_at);

alter table public.access_requests enable row level security;

-- The requester sees their own; an institute's admins see requests to it.
-- Nobody writes directly: the functions below are the only path.
create policy access_requests_read on public.access_requests
  for select to authenticated
  using (user_id = auth.uid() or public.my_role(institute_id) = 'institute_admin');

-- Institutes a signed-in person can ask to join: active tenants they are not
-- already in. Names only.
create or replace function public.requestable_institutes()
returns table (id uuid, name text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  return query
  select i.id, i.name from institutes i
  where i.kind = 'institute' and i.status = 'active'
    and not exists (select 1 from institute_members m where m.institute_id = i.id and m.user_id = auth.uid())
  order by i.name;
end;
$$;

create or replace function public.request_access(p_institute_id uuid, p_note text default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not exists (select 1 from institutes where id = p_institute_id and kind = 'institute' and status = 'active') then
    raise exception 'institute not found';
  end if;
  if exists (select 1 from institute_members where institute_id = p_institute_id and user_id = auth.uid()) then
    raise exception 'you are already a member of this institute';
  end if;
  if exists (select 1 from access_requests where institute_id = p_institute_id and user_id = auth.uid() and status = 'pending') then
    raise exception 'you have already asked this institute; wait for them to answer';
  end if;
  if (select count(*) from access_requests where user_id = auth.uid() and status = 'pending') >= 5 then
    raise exception 'you have five requests waiting; wait for an answer before asking more institutes';
  end if;

  insert into access_requests (institute_id, user_id, note)
  values (p_institute_id, auth.uid(), nullif(left(trim(coalesce(p_note, '')), 500), ''))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.withdraw_access_request(p_request_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update access_requests set status = 'withdrawn', decided_at = now()
  where id = p_request_id and user_id = auth.uid() and status = 'pending';
  if not found then
    raise exception 'request not found, or already answered';
  end if;
end;
$$;

-- The requester's own requests, with institute names (which RLS on
-- institutes would otherwise hide from a non-member).
create or replace function public.my_access_requests()
returns table (id uuid, institute_id uuid, institute_name text, status text, granted_role text, reason text, created_at timestamptz, decided_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select r.id, r.institute_id, i.name, r.status, r.granted_role, r.reason, r.created_at, r.decided_at
  from access_requests r join institutes i on i.id = r.institute_id
  where r.user_id = auth.uid()
  order by r.created_at desc
  limit 50
$$;

-- Pending requests to one institute, for its admins, with the requester's
-- name (a non-member's profile is not readable under RLS).
create or replace function public.institute_access_requests(p_institute_id uuid)
returns table (id uuid, user_id uuid, username text, full_name text, email text, note text, created_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if coalesce(my_role(p_institute_id), '') <> 'institute_admin' then
    raise exception 'institute admin only';
  end if;
  return query
  select r.id, r.user_id, p.username::text, p.full_name, p.email::text, r.note, r.created_at
  from access_requests r join profiles p on p.id = r.user_id
  where r.institute_id = p_institute_id and r.status = 'pending'
  order by r.created_at;
end;
$$;

-- Every pending request, for the platform owner. Shows people's names and
-- which institutes they asked, so it is logged like any tenant read.
create or replace function public.platform_access_requests_pending(p_limit int default 200)
returns table (id uuid, institute_id uuid, institute_name text, user_id uuid, username text, full_name text, email text, note text, created_at timestamptz)
language plpgsql security definer set search_path = public
as $$
begin
  perform platform_guard();
  insert into platform_access_log (actor, institute_id, action, target_table)
  values (auth.uid(), null, 'read_access_requests', 'access_requests');
  return query
  select r.id, r.institute_id, i.name, r.user_id, p.username::text, p.full_name, p.email::text, r.note, r.created_at
  from access_requests r
  join institutes i on i.id = r.institute_id
  join profiles p on p.id = r.user_id
  where r.status = 'pending'
  order by r.created_at
  limit greatest(1, least(p_limit, 500));
end;
$$;

-- Aggregate only (not logged): how many requests are waiting, platform-wide.
create or replace function public.platform_pending_access_count()
returns int
language plpgsql stable security definer set search_path = public
as $$
begin
  perform platform_guard();
  return (select count(*)::int from access_requests where status = 'pending');
end;
$$;

create or replace function public.decide_access_request(
  p_request_id uuid,
  p_approve boolean,
  p_role text default null,
  p_reason text default null
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_req record;
  v_owner boolean := is_platform_owner();
  v_admin boolean;
begin
  select r.id, r.institute_id, r.user_id into v_req
  from access_requests r where r.id = p_request_id and r.status = 'pending';
  if v_req.id is null then
    raise exception 'request not found, or already answered';
  end if;

  v_admin := coalesce(my_role(v_req.institute_id), '') = 'institute_admin';
  if not v_owner and not v_admin then
    raise exception 'not authorised';
  end if;

  if p_approve then
    if p_role is null or p_role not in ('institute_admin', 'teacher', 'student') then
      raise exception 'choose a role: teacher, student or institute admin';
    end if;
    if p_role = 'institute_admin' and not v_owner then
      raise exception 'only the platform can make someone an institute admin';
    end if;
    if not exists (select 1 from institutes where id = v_req.institute_id and status = 'active') then
      raise exception 'this institute is not active';
    end if;
    if exists (select 1 from institute_members where institute_id = v_req.institute_id and user_id = v_req.user_id) then
      raise exception 'already a member of this institute';
    end if;

    insert into institute_members (institute_id, user_id, role)
    values (v_req.institute_id, v_req.user_id, p_role);
    insert into role_audit (institute_id, actor, target, old_role, new_role)
    values (v_req.institute_id, auth.uid(), v_req.user_id, null, p_role);
    update access_requests
      set status = 'approved', granted_role = p_role, decided_by = auth.uid(), decided_at = now()
      where id = p_request_id;
  else
    if p_reason is null or length(trim(p_reason)) < 3 then
      raise exception 'give a reason they will see';
    end if;
    update access_requests
      set status = 'declined', reason = left(trim(p_reason), 500), decided_by = auth.uid(), decided_at = now()
      where id = p_request_id;
  end if;

  if v_owner and not v_admin then
    insert into platform_access_log (actor, institute_id, action, target_table, target_id, detail)
    values (auth.uid(), v_req.institute_id,
            case when p_approve then 'access_request_approved' else 'access_request_declined' end,
            'access_requests', p_request_id,
            case when p_approve then 'as ' || p_role else left(trim(p_reason), 500) end);
  end if;
end;
$$;

grant execute on function public.requestable_institutes() to authenticated;
grant execute on function public.request_access(uuid, text) to authenticated;
grant execute on function public.withdraw_access_request(uuid) to authenticated;
grant execute on function public.my_access_requests() to authenticated;
grant execute on function public.institute_access_requests(uuid) to authenticated;
grant execute on function public.platform_access_requests_pending(int) to authenticated;
grant execute on function public.platform_pending_access_count() to authenticated;
grant execute on function public.decide_access_request(uuid, boolean, text, text) to authenticated;

-- ============================================================================
-- DOWN
-- ============================================================================
/*
drop function if exists public.decide_access_request(uuid, boolean, text, text);
drop function if exists public.platform_pending_access_count();
drop function if exists public.platform_access_requests_pending(int);
drop function if exists public.institute_access_requests(uuid);
drop function if exists public.my_access_requests();
drop function if exists public.withdraw_access_request(uuid);
drop function if exists public.request_access(uuid, text);
drop function if exists public.requestable_institutes();
drop policy if exists access_requests_read on public.access_requests;
drop table if exists public.access_requests;
-- Re-run accept_invite from 20260916000012 and handle_new_user from 20260903000001.
drop index if exists public.profiles_username_key;
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles drop column if exists username;
*/
