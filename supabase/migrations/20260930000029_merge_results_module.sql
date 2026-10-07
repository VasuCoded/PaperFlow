-- ============================================================================
-- "Results and analytics" is no longer a module of its own: it comes with the
-- student app. module_enabled('results') still answers (as student_app) so
-- nothing that asks for it breaks; the stored key is dropped and
-- platform_set_modules() no longer accepts it.
-- ============================================================================

create or replace function public.module_enabled(p_institute_id uuid, p_module text)
returns boolean language sql stable security definer set search_path = public
as $$
  with m as (select coalesce(modules, '{}'::jsonb) as v from public.institutes where id = p_institute_id),
  raw as (
    select
      coalesce((select (v ->> 'student_app')::boolean from m), true) as student_app,
      coalesce((select (v ->> 'teachers')::boolean from m), true) as teachers,
      coalesce((select (v ->> 'self_practice')::boolean from m), false) as self_practice
  )
  select case p_module
    when 'student_app' then student_app
    when 'results' then student_app
    when 'teachers' then teachers
    when 'self_practice' then student_app and self_practice
    else false
  end
  from raw
$$;

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
  foreach v_key in array array['student_app', 'teachers', 'self_practice'] loop
    if p_modules ? v_key and jsonb_typeof(p_modules -> v_key) = 'boolean' then
      v_clean := v_clean || jsonb_build_object(v_key, p_modules -> v_key);
    end if;
  end loop;
  update institutes set modules = v_clean where id = p_institute_id;
  insert into platform_access_log (actor, institute_id, action, target_table, target_id, detail)
  values (auth.uid(), p_institute_id, 'set_modules', 'institutes', p_institute_id, v_clean::text);
end;
$$;

update public.institutes set modules = modules - 'results' where modules ? 'results';

-- ============================================================================
-- DOWN (manual): restore module_enabled and platform_set_modules from 0027.
-- ============================================================================
