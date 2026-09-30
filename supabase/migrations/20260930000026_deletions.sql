-- ============================================================================
-- Deleting batches, papers and institutes, each by the right people and with
-- the right guard.
--
-- delete_batch: an admin, or a teacher who runs the batch (teaches_in_batch).
--   Its enrolments go with it. Its papers are KEPT (papers.batch_id is set
--   null by the foreign key), but taken back out of students' view: an
--   unbatched paper would otherwise reach every student of its subject.
--   Students who already logged one keep it (can_access_paper's attempt rule).
--
-- delete_paper: an admin, or the teacher who set it. If students have logged
--   it, their logs go too, so the caller must pass the paper's printed code.
--
-- platform_delete_institute: the platform owner only, for an institute that
--   is already suspended, confirmed by typing its slug. Everything the
--   institute owns cascades; accounts stay (they only lose the membership).
--   The deletion is written to the access log, which outlives it.
-- ============================================================================

create or replace function public.delete_batch(p_batch_id uuid)
returns int language plpgsql security definer set search_path = public
as $$
declare
  v_inst uuid;
  v_papers int;
begin
  select institute_id into v_inst from batches where id = p_batch_id;
  if v_inst is null then
    raise exception 'batch not found';
  end if;
  if not (coalesce(my_role(v_inst), '') = 'institute_admin' or teaches_in_batch(p_batch_id)) then
    raise exception 'not authorised for this batch';
  end if;

  update papers set released_at = null
  where institute_id = v_inst and batch_id = p_batch_id;
  get diagnostics v_papers = row_count;

  delete from batches where id = p_batch_id and institute_id = v_inst;
  return v_papers;
end;
$$;
grant execute on function public.delete_batch(uuid) to authenticated;

create or replace function public.delete_paper(p_paper_id uuid, p_confirm_code text default null)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_paper record;
  v_logged int;
begin
  select id, institute_id, teacher_id, code into v_paper from papers where id = p_paper_id;
  if v_paper.id is null or v_paper.institute_id not in (select my_institutes()) then
    raise exception 'paper not found';
  end if;
  if not (
    coalesce(my_role(v_paper.institute_id), '') = 'institute_admin'
    or (coalesce(my_role(v_paper.institute_id), '') = 'teacher' and v_paper.teacher_id = auth.uid())
  ) then
    raise exception 'only the teacher who set this paper, or an institute admin, can delete it';
  end if;

  select count(*) into v_logged from attempts where paper_id = p_paper_id and institute_id = v_paper.institute_id;
  if v_logged > 0 and upper(coalesce(trim(p_confirm_code), '')) <> upper(v_paper.code) then
    raise exception 'students have logged this paper: type its code % to delete it and their logs', v_paper.code;
  end if;

  delete from papers where id = p_paper_id and institute_id = v_paper.institute_id;
end;
$$;
grant execute on function public.delete_paper(uuid, text) to authenticated;

create or replace function public.platform_delete_institute(p_institute_id uuid, p_confirm_slug text)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_inst record;
begin
  perform platform_guard();
  select id, name, slug, status, kind into v_inst from institutes where id = p_institute_id;
  if v_inst.id is null or v_inst.kind <> 'institute' then
    raise exception 'institute not found';
  end if;
  if v_inst.status <> 'suspended' then
    raise exception 'suspend the institute first; only a suspended institute can be deleted';
  end if;
  if lower(coalesce(trim(p_confirm_slug), '')) <> lower(v_inst.slug) then
    raise exception 'type the institute''s slug (%) to confirm', v_inst.slug;
  end if;

  insert into platform_access_log (actor, institute_id, action, target_table, target_id, detail)
  values (auth.uid(), null, 'delete_institute', 'institutes', v_inst.id, format('%s (%s)', v_inst.name, v_inst.slug));

  delete from institutes where id = v_inst.id;
end;
$$;
grant execute on function public.platform_delete_institute(uuid, text) to authenticated;

-- ============================================================================
-- DOWN
-- ============================================================================
/*
drop function if exists public.platform_delete_institute(uuid, text);
drop function if exists public.delete_paper(uuid, text);
drop function if exists public.delete_batch(uuid);
*/
