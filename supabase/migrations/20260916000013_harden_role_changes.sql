-- ============================================================================
-- 0013 · HARDEN ROLE CHANGES FOR THE INSTITUTE CONSOLE
--
-- Found while wiring /institute/members to these functions:
--
-- 1. set_member_role upserted a membership for ANY profile email. An institute
--    admin could therefore pull an existing user — a student of another
--    institute, say — into their own institute without an invite, skipping the
--    consent step the invitation system exists for. And its "no such user: %"
--    message told any admin whether an email had a PaperFlow account.
--    Now: an institute admin may only change the role of someone who is
--    ALREADY a teacher or student of their own institute. Everything else gets
--    the same message. Adding people is what invites are for. The platform
--    owner keeps the upsert (it is how a replacement institute admin is made).
--
-- 2. set_member_role let an institute admin set teacher/student on a fellow
--    institute_admin — a demotion. Admins are changed by the platform only,
--    matching remove_member.
--
-- 3. remove_member checked membership BEFORE authorisation, so anyone could
--    learn whether a user belonged to an institute from the error text.
-- ============================================================================

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
  v_caller_role text := coalesce(public.my_role(p_institute_id), '');
begin
  if p_new_role not in ('institute_admin', 'teacher', 'student') then
    raise exception 'invalid role: %', p_new_role;
  end if;

  if not v_is_owner and v_caller_role <> 'institute_admin' then
    raise exception 'not authorised to set roles in this institute';
  end if;
  if not v_is_owner and p_new_role not in ('teacher', 'student') then
    raise exception 'institute_admin may set only teacher or student';
  end if;

  select m.user_id, m.role into v_target, v_old_role
  from public.institute_members m
  join public.profiles p on p.id = m.user_id
  where m.institute_id = p_institute_id and p.email = p_target_email;

  if v_is_owner then
    if v_target is null then
      select id into v_target from public.profiles where email = p_target_email;
      if v_target is null then
        raise exception 'no such user: %', p_target_email;
      end if;
    end if;
    if v_old_role = 'owner' then
      raise exception 'the platform owner role is not changed here';
    end if;
  else
    -- One message for "no account", "not in this institute" and "is an admin".
    if v_target is null or v_old_role not in ('teacher', 'student') then
      raise exception 'not a teacher or student of this institute';
    end if;
  end if;

  if v_old_role is not distinct from p_new_role then
    return;
  end if;

  insert into public.institute_members (institute_id, user_id, role)
  values (p_institute_id, v_target, p_new_role)
  on conflict (institute_id, user_id) do update set role = excluded.role;

  insert into public.role_audit (institute_id, actor, target, old_role, new_role)
  values (p_institute_id, auth.uid(), v_target, v_old_role, p_new_role);
end;
$$;

create or replace function public.remove_member(p_institute_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_role text;
  v_is_owner boolean := is_platform_owner();
begin
  if not v_is_owner and coalesce(my_role(p_institute_id), '') <> 'institute_admin' then
    raise exception 'not authorised';
  end if;

  select role into v_role from institute_members
  where institute_id = p_institute_id and user_id = p_user_id;
  if v_role is null then
    raise exception 'not a member of this institute';
  end if;
  if v_role = 'owner' then
    raise exception 'the platform owner cannot be removed here';
  end if;
  if not v_is_owner and v_role not in ('teacher', 'student') then
    raise exception 'an institute admin can only remove teachers and students';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'you cannot remove yourself';
  end if;

  delete from teacher_subjects where institute_id = p_institute_id and teacher_id = p_user_id;
  delete from enrolments where institute_id = p_institute_id and student_id = p_user_id;
  delete from institute_members where institute_id = p_institute_id and user_id = p_user_id;

  insert into role_audit (institute_id, actor, target, old_role, new_role)
  values (p_institute_id, auth.uid(), p_user_id, v_role, null);
end;
$$;

-- ============================================================================
-- DOWN
-- ============================================================================
/*
-- Re-run set_member_role from 20260903000001_create_tenancy.sql and
-- remove_member from 20260916000010_create_activity_functions.sql.
*/
