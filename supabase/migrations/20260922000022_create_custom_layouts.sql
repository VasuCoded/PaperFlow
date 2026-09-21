-- ============================================================================
-- 0022 · CUSTOM PAPER LAYOUTS
--
-- A teacher can now set a paper from a quick template or a layout they build
-- themselves (any number of sections, question kinds, marks, counts, internal
-- choice, time, instructions) as well as from a stored pattern.
--
-- A saved paper keeps pointing at the exact layout it was built from, so a
-- template or custom layout is stored as an institute-owned pattern when the
-- paper is saved. Teachers cannot write paper_patterns under RLS (only
-- institute admins can), so they do it through create_paper_layout(), which
-- checks what RLS would: the caller teaches this class-subject at this
-- institute (or is its admin) and the subject is active there.
--
--   listed = true   a named template the institute sees in its list
--   listed = false  the one-off layout behind a single paper
-- ============================================================================

alter table public.paper_patterns add column if not exists listed boolean not null default true;
alter table public.paper_patterns add column if not exists created_by uuid references auth.users (id) on delete set null;
alter table public.paper_patterns add column if not exists general_instructions text;
alter table public.papers add column if not exists instructions text;

create or replace function public.create_paper_layout(
  p_institute_id uuid,
  p_class_subject_id uuid,
  p_name text,
  p_general_instructions text,
  p_sections jsonb,
  p_listed boolean,
  -- last, with a default: omitted means no time limit
  p_duration_min int default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_role text := public.my_role(p_institute_id);
  v_pattern uuid;
  v_total int := 0;
  v_count int := 0;
  v_sec jsonb;
  v_qc int;
  v_me int;
begin
  if v_role is null or v_role not in ('teacher', 'institute_admin') then
    raise exception 'only a teacher or institute admin of this institute can save a paper layout' using errcode = '42501';
  end if;
  if v_role = 'teacher' and not public.teaches(p_institute_id, p_class_subject_id) then
    raise exception 'you are not assigned to that class and subject' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.institute_class_subjects
    where institute_id = p_institute_id and class_subject_id = p_class_subject_id and status = 'active'
  ) then
    raise exception 'that class and subject is not active for this institute' using errcode = '42501';
  end if;

  if jsonb_typeof(p_sections) is distinct from 'array' or jsonb_array_length(p_sections) not between 1 and 12 then
    raise exception 'a layout has between 1 and 12 sections' using errcode = '22023';
  end if;
  for v_sec in select value from jsonb_array_elements(p_sections) loop
    v_qc := (v_sec ->> 'question_count')::int;
    v_me := (v_sec ->> 'marks_each')::int;
    if v_qc is null or v_qc not between 1 and 200 or v_me is null or v_me not between 1 and 20
       or jsonb_typeof(v_sec -> 'question_types') is distinct from 'array'
       or jsonb_array_length(v_sec -> 'question_types') = 0 then
      raise exception 'invalid section in layout' using errcode = '22023';
    end if;
    v_total := v_total + v_qc * v_me;
    v_count := v_count + v_qc;
  end loop;
  if v_count > 200 or v_total > 400 then
    raise exception 'a paper has at most 200 questions and 400 marks' using errcode = '22023';
  end if;
  if p_duration_min is not null and p_duration_min not between 5 and 360 then
    raise exception 'time must be between 5 and 360 minutes' using errcode = '22023';
  end if;

  insert into public.paper_patterns
    (owner_institute_id, class_subject_id, name, total_marks, duration_min, origin, is_default, listed, created_by, general_instructions)
  values
    (p_institute_id, p_class_subject_id, left(coalesce(nullif(trim(p_name), ''), 'Custom paper'), 80), v_total, p_duration_min,
     'institute', false, coalesce(p_listed, false), auth.uid(), nullif(left(trim(coalesce(p_general_instructions, '')), 1000), ''))
  returning id into v_pattern;

  insert into public.pattern_sections
    (pattern_id, owner_institute_id, label, sort_order, instructions, question_count, marks_each,
     question_types, allow_choice, practice_eligible, requires_stimulus)
  select v_pattern, p_institute_id, chr(64 + e.ord::int), e.ord::int - 1,
         nullif(left(trim(coalesce(e.v ->> 'instructions', '')), 300), ''),
         (e.v ->> 'question_count')::int, (e.v ->> 'marks_each')::int,
         array(select jsonb_array_elements_text(e.v -> 'question_types')),
         coalesce((e.v ->> 'allow_choice')::boolean, false),
         coalesce((e.v ->> 'practice_eligible')::boolean, true),
         coalesce((e.v ->> 'requires_stimulus')::boolean, false)
  from jsonb_array_elements(p_sections) with ordinality as e(v, ord);

  return v_pattern;
end;
$$;

-- A saved template leaves the list (papers built from it keep pointing at it).
-- Its creator or an institute admin may do this.
create or replace function public.unlist_paper_layout(p_pattern_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_owner uuid;
  v_creator uuid;
begin
  select owner_institute_id, created_by into v_owner, v_creator
  from public.paper_patterns where id = p_pattern_id and origin = 'institute';
  if v_owner is null
     or not (v_creator = auth.uid() or public.my_role(v_owner) = 'institute_admin') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.paper_patterns set listed = false where id = p_pattern_id;
end;
$$;

revoke execute on function public.create_paper_layout(uuid, uuid, text, text, jsonb, boolean, int) from public, anon;
revoke execute on function public.unlist_paper_layout(uuid) from public, anon;
grant execute on function public.create_paper_layout(uuid, uuid, text, text, jsonb, boolean, int) to authenticated;
grant execute on function public.unlist_paper_layout(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Down:
-- drop function if exists public.unlist_paper_layout(uuid);
-- drop function if exists public.create_paper_layout(uuid, uuid, text, text, jsonb, boolean, int);
-- alter table public.papers drop column if exists instructions;
-- alter table public.paper_patterns drop column if exists general_instructions;
-- alter table public.paper_patterns drop column if exists created_by;
-- alter table public.paper_patterns drop column if exists listed;
-- ----------------------------------------------------------------------------
