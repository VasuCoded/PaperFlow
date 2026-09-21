-- ============================================================================
-- questions_normalise() calls pgcrypto's digest(), but pins search_path to
-- public. Locally (and in PGlite) pgcrypto lives in public, so it worked; on
-- Supabase pgcrypto is preinstalled in the `extensions` schema, so every
-- insert or body update on questions failed with
--   function digest(text, unknown) does not exist.
-- Add `extensions` to the function's search_path. A schema that does not
-- exist in search_path is ignored, so this is correct in both places.
-- ============================================================================

create or replace function public.questions_normalise()
returns trigger language plpgsql set search_path = public, extensions
as $$
declare
  v_script text;
begin
  new.body_normalised := trim(regexp_replace(normalize(new.body, NFC), '\s+', ' ', 'g'));
  new.body_hash := encode(digest(new.body_normalised, 'sha256'), 'hex');

  select s.script into v_script
  from public.class_subjects cs
  join public.subjects s on s.id = cs.subject_id
  where cs.id = new.class_subject_id;

  new.tsv_config := case when v_script = 'devanagari' then 'simple' else 'english' end;
  new.search_tsv := to_tsvector(new.tsv_config::regconfig, coalesce(new.body_normalised, ''));

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Down:
-- create or replace function public.questions_normalise()
-- returns trigger language plpgsql set search_path = public
-- as $$ ... body unchanged ... $$;
-- ----------------------------------------------------------------------------
