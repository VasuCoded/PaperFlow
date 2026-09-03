-- ============================================================================
-- Shared test fixtures. Included (\ir) by the RLS / tenancy / isolation suites.
-- Assumes the caller has already opened a transaction. Seeds run as the
-- migration role (bypasses RLS), setting up cross-tenant data the suites then
-- read back AS each user to prove isolation. All UUIDs are valid hex.
-- Platform institute id = 11111111-1111-1111-1111-111111111111 (see 0001).
-- ============================================================================

-- Test users (auth.users insert fires handle_new_user -> profiles).
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000ff', 'owner@platform.test',   'authenticated', 'authenticated'),
  ('a1a1a1a1-0000-0000-0000-000000000001', 'admin.a@inst.test',     'authenticated', 'authenticated'),
  ('a2a2a2a2-0000-0000-0000-000000000001', 'teacher.a@inst.test',   'authenticated', 'authenticated'),
  ('a3a3a3a3-0000-0000-0000-000000000001', 'student.a1@inst.test',  'authenticated', 'authenticated'),
  ('a4a4a4a4-0000-0000-0000-000000000001', 'student.a2@inst.test',  'authenticated', 'authenticated'),
  ('b1b1b1b1-0000-0000-0000-000000000001', 'admin.b@inst.test',     'authenticated', 'authenticated'),
  ('b2b2b2b2-0000-0000-0000-000000000001', 'teacher.b@inst.test',   'authenticated', 'authenticated'),
  ('b3b3b3b3-0000-0000-0000-000000000001', 'student.b1@inst.test',  'authenticated', 'authenticated'),
  ('b4b4b4b4-0000-0000-0000-000000000001', 'student.b2@inst.test',  'authenticated', 'authenticated'),
  ('cccccccc-0000-0000-0000-000000000001', 'moonlighter@inst.test', 'authenticated', 'authenticated')
on conflict (id) do nothing;

-- Platform owner membership on the platform pseudo-institute (H5b).
insert into public.institute_members (institute_id, user_id, role) values
  (public.platform_institute_id(), '00000000-0000-0000-0000-0000000000ff', 'owner')
on conflict do nothing;

-- Two tenant institutes.
insert into public.institutes (id, name, slug, kind, status) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Institute A', 'inst-a', 'institute', 'active'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Institute B', 'inst-b', 'institute', 'active')
on conflict (id) do nothing;

-- Memberships. The moonlighter teaches at BOTH A and B.
insert into public.institute_members (institute_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a1a1a1a1-0000-0000-0000-000000000001', 'institute_admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a2a2a2a2-0000-0000-0000-000000000001', 'teacher'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a3a3a3a3-0000-0000-0000-000000000001', 'student'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a4a4a4a4-0000-0000-0000-000000000001', 'student'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b1b1b1b1-0000-0000-0000-000000000001', 'institute_admin'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b2b2b2b2-0000-0000-0000-000000000001', 'teacher'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b3b3b3b3-0000-0000-0000-000000000001', 'student'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b4b4b4b4-0000-0000-0000-000000000001', 'student'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-0000-0000-0000-000000000001', 'teacher'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-0000-0000-0000-000000000001', 'teacher')
on conflict do nothing;

-- Minimal taxonomy: one class-subject, ready, activated for both institutes.
insert into public.classes (id, name, sort_order) values
  ('00000010-0000-0000-0000-000000000010', '10', 10) on conflict (id) do nothing;
insert into public.subjects (id, name, short_name, script) values
  ('5c1e0000-0000-0000-0000-000000000001', 'Science', 'SCI', 'latin') on conflict (id) do nothing;
insert into public.class_subjects (id, class_id, subject_id, bank_status) values
  ('c5000000-0000-0000-0000-000000000001',
   '00000010-0000-0000-0000-000000000010',
   '5c1e0000-0000-0000-0000-000000000001', 'ready') on conflict (id) do nothing;
insert into public.chapters (id, class_subject_id, name, sort_order) values
  ('c4a70000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', 'Chemical Reactions', 1)
  on conflict (id) do nothing;
insert into public.topics (id, chapter_id, name, slug) values
  ('40910000-0000-0000-0000-000000000001', 'c4a70000-0000-0000-0000-000000000001', 'Balancing equations', 'balancing')
  on conflict (id) do nothing;

insert into public.institute_class_subjects (institute_id, class_subject_id, status, activated_at) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c5000000-0000-0000-0000-000000000001', 'active', now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'c5000000-0000-0000-0000-000000000001', 'active', now())
on conflict do nothing;

-- Teacher assignments.
insert into public.teacher_subjects (institute_id, teacher_id, class_subject_id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a2a2a2a2-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b2b2b2b2-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001')
on conflict do nothing;

-- One shared (platform) question and one private question per institute.
insert into public.questions (id, owner_institute_id, class_subject_id, chapter_id, topic_id, body, question_type, answer, marks, difficulty)
values
  ('90000000-0000-0000-0000-0000000000f1', public.platform_institute_id(),
   'c5000000-0000-0000-0000-000000000001', 'c4a70000-0000-0000-0000-000000000001',
   '40910000-0000-0000-0000-000000000001', 'Balance: H2 + O2 -> H2O', 'short', '2H2 + O2 -> 2H2O', 3, 'medium'),
  ('90000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'c5000000-0000-0000-0000-000000000001', 'c4a70000-0000-0000-0000-000000000001',
   '40910000-0000-0000-0000-000000000001', 'A private question for institute A', 'short', 'answer A', 2, 'easy'),
  ('90000000-0000-0000-0000-0000000000b1', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'c5000000-0000-0000-0000-000000000001', 'c4a70000-0000-0000-0000-000000000001',
   '40910000-0000-0000-0000-000000000001', 'A private question for institute B', 'short', 'answer B', 2, 'easy')
on conflict (id) do nothing;
-- The status guard forces inserts to 'staging'; flip to approved for tests.
update public.questions set status = 'approved'
  where id in ('90000000-0000-0000-0000-0000000000f1',
               '90000000-0000-0000-0000-0000000000a1',
               '90000000-0000-0000-0000-0000000000b1');

-- Batches + enrolments, one per institute.
insert into public.batches (id, institute_id, name, class_subject_id, teacher_id, join_code, active) values
  ('ba700000-0000-0000-0000-00000000000a', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A-10-SCI',
   'c5000000-0000-0000-0000-000000000001', 'a2a2a2a2-0000-0000-0000-000000000001', 'AAA234', true),
  ('ba700000-0000-0000-0000-00000000000b', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'B-10-SCI',
   'c5000000-0000-0000-0000-000000000001', 'b2b2b2b2-0000-0000-0000-000000000001', 'BBB234', true)
on conflict (id) do nothing;

insert into public.enrolments (institute_id, batch_id, student_id, class_subject_id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ba700000-0000-0000-0000-00000000000a', 'a3a3a3a3-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'ba700000-0000-0000-0000-00000000000b', 'b3b3b3b3-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001')
on conflict do nothing;

-- A paper + attempt per institute (so paper/attempt isolation can be checked).
insert into public.papers (id, institute_id, teacher_id, batch_id, class_subject_id, title, total_marks, status) values
  ('9a9e0000-0000-0000-0000-00000000000a', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a2a2a2a2-0000-0000-0000-000000000001', 'ba700000-0000-0000-0000-00000000000a', 'c5000000-0000-0000-0000-000000000001', 'A Unit Test 1', 20, 'generated'),
  ('9a9e0000-0000-0000-0000-00000000000b', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b2b2b2b2-0000-0000-0000-000000000001', 'ba700000-0000-0000-0000-00000000000b', 'c5000000-0000-0000-0000-000000000001', 'B Unit Test 1', 20, 'generated')
on conflict (id) do nothing;

insert into public.attempts (id, institute_id, paper_id, student_id, source) values
  ('a77e0000-0000-0000-0000-00000000000a', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '9a9e0000-0000-0000-0000-00000000000a', 'a3a3a3a3-0000-0000-0000-000000000001', 'student'),
  ('a77e0000-0000-0000-0000-00000000000b', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '9a9e0000-0000-0000-0000-00000000000b', 'b3b3b3b3-0000-0000-0000-000000000001', 'student')
on conflict (id) do nothing;

insert into public.attempt_items (institute_id, attempt_id, question_id, is_correct) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a77e0000-0000-0000-0000-00000000000a', '90000000-0000-0000-0000-0000000000f1', false),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'a77e0000-0000-0000-0000-00000000000b', '90000000-0000-0000-0000-0000000000f1', false)
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- Test helper: become an authenticated user by uid (sets role + jwt claim so
-- auth.uid() resolves). Reset with `reset role;`.
-- ----------------------------------------------------------------------------
create or replace function public.test_as(p_uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
end;
$$;
