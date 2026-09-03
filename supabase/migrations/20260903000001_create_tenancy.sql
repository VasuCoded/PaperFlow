-- ============================================================================
-- 0001 · TENANCY
-- BUILD-PLAN section 5.0. Three tables and one seeded row carry the whole
-- multi-tenant model. Every RLS policy in the system has the same shape
-- because the shared bank is owned by a REAL row (kind='platform'), never a
-- nullable institute_id.
-- ============================================================================

create extension if not exists citext;
create extension if not exists pg_trgm;
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- profiles — one row per auth.users. NO role column (5.5). Roles live in
-- institute_members. Global reference table (allowlisted).
-- ----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email citext not null,
  full_name text,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- institutes — the tenant registry, plus the single platform pseudo-institute.
-- ----------------------------------------------------------------------------
create table public.institutes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  kind text not null check (kind in ('platform', 'institute')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  contact_email citext,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

-- At most one platform institute, ever.
create unique index institutes_one_platform
  on public.institutes ((kind = 'platform'))
  where kind = 'platform';

create table public.institute_members (
  institute_id uuid not null references public.institutes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'institute_admin', 'teacher', 'student')),
  created_at timestamptz not null default now(),
  primary key (institute_id, user_id)
);

create table public.institute_invites (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes (id) on delete cascade,
  email citext not null,
  role text not null check (role in ('institute_admin', 'teacher', 'student')),
  invited_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (institute_id, email)
);

create table public.role_audit (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes (id) on delete cascade,
  actor uuid references auth.users (id),
  target uuid references auth.users (id),
  old_role text,
  new_role text,
  at timestamptz not null default now()
);

-- platform_access_log — every audited read/write of tenant data by the
-- platform owner (5.8). institute_id is the tenant that was inspected.
create table public.platform_access_log (
  id uuid primary key default gen_random_uuid(),
  actor uuid references auth.users (id),
  institute_id uuid references public.institutes (id) on delete set null,
  action text not null,
  target_table text,
  target_id uuid,
  at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Helper functions. All SECURITY DEFINER so a policy on institute_members can
-- call them without recursive RLS. All STABLE. Used BY policies, not inlined.
-- ----------------------------------------------------------------------------

-- The fixed platform pseudo-institute UUID. This constant is the single source
-- of truth; the PLATFORM_INSTITUTE_ID env var MUST be set to the same value.
create or replace function public.platform_institute_id()
returns uuid language sql immutable
as $$ select '11111111-1111-1111-1111-111111111111'::uuid $$;

create or replace function public.my_institutes()
returns setof uuid language sql stable security definer set search_path = public
as $$
  select institute_id from public.institute_members where user_id = auth.uid()
$$;

create or replace function public.my_role(inst uuid)
returns text language sql stable security definer set search_path = public
as $$
  select role from public.institute_members
  where user_id = auth.uid() and institute_id = inst
$$;

create or replace function public.is_platform_owner()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.institute_members
    where user_id = auth.uid()
      and institute_id = public.platform_institute_id()
      and role = 'owner'
  )
$$;

-- True when the caller shares at least one institute with the target user.
-- Lets member lists resolve names without leaking cross-tenant profiles.
create or replace function public.shares_institute(target uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.institute_members a
    join public.institute_members b on a.institute_id = b.institute_id
    where a.user_id = auth.uid() and b.user_id = target
  )
$$;

-- ----------------------------------------------------------------------------
-- Seed the platform pseudo-institute (H5b — must exist before anyone signs in).
-- ----------------------------------------------------------------------------
insert into public.institutes (id, name, slug, kind, status, contact_email)
values (
  public.platform_institute_id(),
  'PaperFlow Platform',
  'platform',
  'platform',
  'active',
  null
)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- auth.users insert trigger: create the profiles row and NOTHING else.
-- A new sign-in belongs to no institute (4.3).
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Row level security
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.institutes enable row level security;
alter table public.institute_members enable row level security;
alter table public.institute_invites enable row level security;
alter table public.role_audit enable row level security;
alter table public.platform_access_log enable row level security;

-- profiles: read own, and co-members within a shared institute. Update own.
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_institute(id));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- institutes: members see their own institutes. Platform owner may suspend/
-- reactivate (sole-clause platform policy — legitimate, not an escape hatch).
create policy institutes_select on public.institutes
  for select to authenticated
  using (id in (select public.my_institutes()));

create policy institutes_update_platform on public.institutes
  for update to authenticated
  using (public.is_platform_owner())
  with check (public.is_platform_owner());

-- institute_members: members see co-members in their own institutes. No
-- INSERT/UPDATE/DELETE policy — role changes go only through set_member_role
-- and accept_invite (SECURITY DEFINER). Rule 8.
create policy institute_members_select on public.institute_members
  for select to authenticated
  using (institute_id in (select public.my_institutes()));

-- institute_invites: an institute's own admins manage invites for teacher/
-- student. institute_admin/owner invites are created by create_institute
-- (definer) or a platform RPC. accept_invite / my_pending_invites (definer)
-- let an as-yet-unaffiliated user find their own invite by email. Rule 7 & 9.
create policy institute_invites_select_admin on public.institute_invites
  for select to authenticated
  using (public.my_role(institute_id) = 'institute_admin');

create policy institute_invites_insert_admin on public.institute_invites
  for insert to authenticated
  with check (
    public.my_role(institute_id) = 'institute_admin'
    and role in ('teacher', 'student')
  );

create policy institute_invites_delete_admin on public.institute_invites
  for delete to authenticated
  using (public.my_role(institute_id) = 'institute_admin');

-- role_audit: readable by that institute's admins. Written by definer fns.
create policy role_audit_select on public.role_audit
  for select to authenticated
  using (public.my_role(institute_id) in ('institute_admin', 'owner'));

-- platform_access_log: readable by platform owner only. Written by definer fns.
create policy platform_access_log_select on public.platform_access_log
  for select to authenticated
  using (public.is_platform_owner());

-- ----------------------------------------------------------------------------
-- Role-mutation RPCs (5.7 rules 8-10). The ONLY paths that write memberships,
-- invites accepted, and roles. No API route may touch institute_members.role.
-- ----------------------------------------------------------------------------

-- create_institute — platform owner only. Creates the institute and the first
-- institute_admin invite in one transaction.
create or replace function public.create_institute(
  p_name text,
  p_slug text,
  p_contact_email text,
  p_first_admin_email text
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_platform_owner() then
    raise exception 'only the platform owner may create an institute';
  end if;

  insert into public.institutes (name, slug, kind, status, contact_email, created_by)
  values (p_name, p_slug, 'institute', 'active', p_contact_email, auth.uid())
  returning id into v_id;

  insert into public.institute_invites (institute_id, email, role, invited_by)
  values (v_id, p_first_admin_email, 'institute_admin', auth.uid());

  return v_id;
end;
$$;

-- set_member_role — the only path that changes a role. Writes role_audit.
-- Platform owner: any role in any institute. institute_admin: only teacher/
-- student, only in their own institute. Nobody grants 'owner' on the platform
-- institute through this function. Rule 9.
create or replace function public.set_member_role(
  p_institute_id uuid,
  p_target_email text,
  p_new_role text
)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_target uuid;
  v_old_role text;
  v_is_owner boolean := public.is_platform_owner();
  v_caller_role text := public.my_role(p_institute_id);
begin
  if p_new_role not in ('institute_admin', 'teacher', 'student', 'owner') then
    raise exception 'invalid role: %', p_new_role;
  end if;

  -- Nobody may grant owner on the platform institute through this function.
  if p_new_role = 'owner' then
    raise exception 'owner may not be granted through set_member_role';
  end if;

  if v_is_owner then
    null; -- platform owner may set any (non-owner) role anywhere
  elsif v_caller_role = 'institute_admin' then
    if p_new_role not in ('teacher', 'student') then
      raise exception 'institute_admin may set only teacher or student';
    end if;
  else
    raise exception 'not authorised to set roles in this institute';
  end if;

  select id into v_target from public.profiles where email = p_target_email;
  if v_target is null then
    raise exception 'no such user: %', p_target_email;
  end if;

  select role into v_old_role from public.institute_members
    where institute_id = p_institute_id and user_id = v_target;

  insert into public.institute_members (institute_id, user_id, role)
  values (p_institute_id, v_target, p_new_role)
  on conflict (institute_id, user_id) do update set role = excluded.role;

  insert into public.role_audit (institute_id, actor, target, old_role, new_role)
  values (p_institute_id, auth.uid(), v_target, v_old_role, p_new_role);
end;
$$;

-- accept_invite — matches the caller's verified email case-insensitively,
-- writes institute_members and stamps accepted_at. Rule from 4.3.
create or replace function public.accept_invite(p_invite_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_email citext;
  v_inst uuid;
  v_role text;
  v_accepted timestamptz;
begin
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then
    raise exception 'not authenticated';
  end if;

  select institute_id, role, accepted_at
    into v_inst, v_role, v_accepted
  from public.institute_invites
  where id = p_invite_id and email = v_email;

  if v_inst is null then
    raise exception 'invite not found for this account';
  end if;
  if v_accepted is not null then
    raise exception 'invite already accepted';
  end if;

  insert into public.institute_members (institute_id, user_id, role)
  values (v_inst, auth.uid(), v_role)
  on conflict (institute_id, user_id) do update set role = excluded.role;

  update public.institute_invites set accepted_at = now() where id = p_invite_id;
end;
$$;

-- my_pending_invites — a not-yet-affiliated user cannot SELECT invites via
-- RLS, so /welcome reads them through this definer function by verified email.
create or replace function public.my_pending_invites()
returns table (
  id uuid,
  institute_id uuid,
  institute_name text,
  role text,
  created_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select i.id, i.institute_id, ins.name, i.role, i.created_at
  from public.institute_invites i
  join public.institutes ins on ins.id = i.institute_id
  where i.email = (select email from auth.users where id = auth.uid())
    and i.accepted_at is null
$$;

-- ============================================================================
-- DOWN
-- ============================================================================
/*
drop function if exists public.my_pending_invites();
drop function if exists public.accept_invite(uuid);
drop function if exists public.set_member_role(uuid, text, text);
drop function if exists public.create_institute(text, text, text, text);
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop function if exists public.shares_institute(uuid);
drop function if exists public.is_platform_owner();
drop function if exists public.my_role(uuid);
drop function if exists public.my_institutes();
drop function if exists public.platform_institute_id();
drop table if exists public.platform_access_log;
drop table if exists public.role_audit;
drop table if exists public.institute_invites;
drop table if exists public.institute_members;
drop table if exists public.institutes;
drop table if exists public.profiles;
*/
