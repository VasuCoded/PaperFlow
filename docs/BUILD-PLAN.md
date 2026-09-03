# Question Bank + Mistake-Practice App — Build Plan

**Version:** 3.0 · 3 Sep 2026
**Supersedes:** v1.0 (Class 12 Biology only). v2.1 added account ownership and role assignment. v2.2 replaced the built ingestion pipeline with agentic Claude Code sessions. **v3.0 makes the application multi-institution.**
**Source documents:** `question-bank-pitch.pptx`, `teacher-app-demo.html`, `student-app-demo.html`
**Build agent:** Claude Code, with direct read/write control of the database
**Target:** many institutions, classes 9 to 12, subjects PCMB + Social Science + English + Hindi

---

## 0. Read this first

v2.2 was built for one institution. v3.0 is built for many. That change is cheap in software and expensive in exactly two places, and if you only remember one page of this document, make it this one.

There are now **three** scopes, not two, and they have wildly different costs.

**Build scope: everything, multi-tenant from day one. Cheap.**
The schema already keys off class, subject, chapter and topic. Adding a tenant key to every table, membership-based roles, and per-institute activation costs about 17 extra hours across the whole build. Doing it now is correct. Retrofitting tenancy onto a live single-tenant database with real student data in it is a migration nobody enjoys and several people notice.

**Tenant scope: manual for now. Deliberately.**
The schema supports self-serve institute signup. The application does not, and will not until a second real paying customer exists. See §0.2 — this is a decision, not an omission.

**Seed scope: not everything. This is where the cost still lives.**
A class-subject is only usable once someone has reviewed roughly 1,200 questions for it. At 45 seconds each that is about 15 hours of human attention. Classes 9 to 12 across PCMB, Social Science, English and Hindi is around 26 combinations, which is 390 hours. Multi-tenancy does not change that number. It changes who benefits from it, which is §0.1.

The operating rule for the whole build is unchanged:

> **Built for all. Seeded for some. Shown only where seeded.**

### 0.1 The bank model, decided

**Shared core plus institute-private layer.**

- The **platform** owns a curated question bank. Every institute reads it.
- Each **institute** may add its own private questions. Only that institute reads them.
- Taxonomy (classes, subjects, chapters, topics) and board paper patterns are platform-owned and global.
- Institute-specific paper patterns are private to that institute.

This is the only model where the content cost amortises. Bank-per-institute means every new customer opens an empty app and someone owes them 15 hours per class-subject before it is usable — that is a services business with a login screen, not a product.

**Two consequences to accept consciously, now, not at week nine.**

1. **The platform permanently owns a content operation.** Curating and reviewing the shared bank is an ongoing cost centre with no end date. It is the actual product. The software is the wrapper.

2. **Copyright exposure changes category.** v2.2's risk register rated this "Manageable — internal use only, one institution, cannot be sold or shared outside." Distributing a bank derived from scanned board papers, PYQs and third-party material to multiple paying institutes is not internal use, and it is not the same legal question. Get an answer before the second customer, not after. Prefer NCERT, exemplar and public board material in the shared bank; keep anything of uncertain provenance in the originating institute's private layer where the old "internal use" argument still holds.

### 0.2 Capable of self-onboarding, not doing self-onboarding

Build the tenancy schema and a tested `create_institute()` function callable only by the platform owner. **Do not build a public signup route and hide it behind a feature flag.** A deployed unauthenticated tenant-creation endpoint that is switched off is worse than no endpoint at all, and adding one later is an afternoon.

"Capable" means the data model does not fight you when the time comes. It does not mean the route exists.

There is a second reason. Everywhere else in this plan, a signup form that lets a user influence their own role is forbidden — it is the single most repeated rule in §4 and in CLAUDE.md. A public "create your institute" form is precisely that form. Building it while the rest of the system is designed to forbid it invites someone to reuse the pattern for teachers.

### 0.3 What this changes from v2.2

| Area | v2.2 | v3.0 |
|---|---|---|
| Tenancy | Single institution, implicit | **`institutes` table, tenant key on every scoped table** |
| Infra ownership | Institute email owns GitHub, Vercel, Supabase, domain | **Platform (your friend) owns all infra permanently** |
| Roles | `profiles.role`, one global role per person | **`institute_members`, a role per person per institute** |
| Role names | `admin` meant "can write the bank" | **`platform_owner` and `institute_admin` — two different things** |
| Role assignment | `role_assignments`, email as primary key | **`institute_invites`, scoped per institute** |
| Question bank | One bank | **Platform bank + per-institute private layer** |
| Activation | `class_subjects.status`, global | **`institute_class_subjects.status`, per institute, over a platform-level `bank_status`** |
| Admin surface | `/admin/*`, one console | **`/platform/*` (global) and `/institute/*` (per tenant), separate** |
| Support operations | Maintainer runs SQL | **Real admin UI, because SQL does not scale to a support queue** |
| Total software | 57 h | **~74 h** |

---

## 1. Scope lock

**Software must support**

- Multiple institutions, fully isolated from each other except through the shared bank and shared taxonomy.
- Classes 9, 10, 11, 12.
- Subjects: Physics, Chemistry, Mathematics, Biology, Social Science, English, Hindi. Class 11-12 splits Social Science into History, Geography, Political Science and Economics; classes 9-10 keep it as one subject with four strands. The schema handles both.
- Multiple teachers per institute, each scoped to the class-subjects they teach. A person may be a teacher at more than one institute — coaching staff moonlight, and a schema that assumes otherwise breaks on a real customer.
- Students in multiple batches, one per class-subject, within one institute.
- Paper patterns as data, so a Class 10 Science board pattern and a Class 11 Physics institute unit test are both expressible without a code change.
- Stimulus blocks: comprehension passages, case studies, source-based questions, map questions, data tables. One stimulus, several questions hanging off it.
- Multi-part questions: 6(a), 6(b), 6(c).
- Multiple printed sets per paper, same questions reordered, so neighbours cannot copy.
- Devanagari alongside Latin script, end to end: extraction, storage, search, print.

**Software must not do**

- Online test taking. Tests stay on paper. The entire pitch rests on this.
- Scoring. Right or wrong per question, never a mark or a percentage.
- Public institute signup. See §0.2.
- Platform-owner impersonation of a tenant user. See §5.8.
- Cross-institute anything visible to a tenant: no shared batches, no cross-institute leaderboards, no "other institutes also asked this".
- Class-wide analytics for the teacher. Phase 3.
- Spaced repetition, homework mode, parent view, doubt box, attendance. Later, if the core works.
- Show any class-subject not active for that institute.

---

## 2. The subjects that break assumptions

Unchanged from v2.2. The v2 plan assumed every question is a self-contained Biology question. Four subjects break that in different ways, each cheap to handle at build time and expensive to retrofit.

### 2.1 English and Hindi: stimulus blocks and writing

A comprehension passage carries eight questions. The passage is not a question and the eight questions are meaningless without it. Grammar items come in sets sharing an instruction line. Writing tasks (letter, notice, article, essay) are single large prompts with a marking rubric rather than an answer.

Consequences:

- A `stimuli` table, with questions optionally pointing at one.
- A stimulus and its questions form a **block**. Blocks are the unit of selection, the unit of shuffling, and the unit of printing. Never split one.
- Writing tasks store a `rubric` rather than an `answer`. The generator treats them as a section type with a count, not something to difficulty-balance.

### 2.2 Hindi: Devanagari is not free

- Vision extraction on scanned Devanagari is noticeably less accurate than on Latin. Expect a higher quarantine rate and a slower review pass. Budget 60 seconds per question for Hindi, not 45.
- Postgres has no Hindi text-search dictionary. Use the `simple` configuration plus trigram similarity for both search and near-duplicate detection. Do not use `english` on Hindi rows, it will silently produce nonsense stems.
- Print needs Noto Sans Devanagari embedded server-side. Matra positioning breaks in ways that only a printed page reveals. Add a Hindi page to the H9 print test.
- Normalise to NFC on ingest. The same word in two Unicode normalisations will defeat duplicate detection and search.

### 2.3 Social Science and Maths

- **Social Science**, classes 9-10, is one subject with four strands. A paper draws from all four in fixed proportions. Chapters hang off a strand; the generator's topic-spread rule needs a strand-balance rule above it.
- **Map questions** carry an image the student marks. They cannot be option-shuffled and they usually sit in a fixed position in the paper. Flag them `position_locked`.
- **Maths and Physics**: heavy notation, multi-part questions, numerical answers. Numerical answers need a tolerance field, not a string compare, if you ever automate checking. For the pilot the teacher checks by hand, so store the answer as text plus a `numeric_answer` and `tolerance` for later.
- **Internal choice** ("attempt any one of the following") is standard in board patterns. The pattern table needs `allow_choice` and the generator has to draw two questions for one slot.

### 2.4 The practice loop is weaker in some subjects. Say so.

The mistake-to-practice loop is the differentiator in the pitch and it does not transfer evenly.

| Subject area | Practice loop |
|---|---|
| PCMB objective, short answer, numerical | **Strong.** Wrong on a topic, get more of that topic. Exactly as pitched |
| Social Science factual and source-based | **Strong** |
| English and Hindi grammar, comprehension | **Moderate.** Matching on a grammar topic works. Matching on "comprehension" does not, because the skill is not the passage |
| English and Hindi writing tasks | **Does not apply.** "You lost marks on a letter" cannot generate a useful next letter automatically |
| Maps and diagram-marking | **Does not apply** |

Handle it honestly in the product rather than pretending: mark each section type as `practice_eligible` or not. In the student app, questions from ineligible sections are still tappable so the teacher's data is complete, but they do not generate practice items and they do not enter the weak-spot map. The app should say "no practice set for the writing section" rather than serve three random essay prompts.

If you pitch the practice loop for English writing, the first month kills your credibility on the part of the product that actually works. This matters more at multiple institutes than one, because the failure now propagates to every customer simultaneously.

---

## 3. Multiple shuffled sets per paper

Unchanged from v2.2. N printed variants of the same test so adjacent students cannot copy.

### 3.1 Design decisions

**Same questions, reordered. Never different questions.** Different questions means different difficulty, which means marking is unfair in a way nobody can defend to a parent.

**Shuffle within a section only.** Section A is the 1-mark section. A 5-mark question landing at position 3 makes the printed section headers lies.

**The shuffle unit is a block, not a question.** A stimulus and its questions move together, in order, as one unit. Sub-parts 6(a), 6(b), 6(c) stay in order under 6. A naive per-question shuffle passes every test on a Biology paper and destroys an English paper.

**Every display position carries the same marks in every set.** This is what keeps hand-checking cheap: the marking column has the same shape on all three papers. Where a section mixes mark values, permute within mark-value groups inside that section. Enforce as a database constraint, not a convention.

**Position-locked questions do not move.** Map questions, and anything the pattern pins to a fixed slot.

**Option shuffling is opt-in per question.** It breaks on "all of the above", "both A and C", numerically or chronologically ordered options, and assertion-reason questions. `questions.options_shufflable` defaults to false; the ingestion detector may set it true; a human can flip it in review.

**Store the permutation as rows, not a seed.** Reprinting Set B in March must be byte identical, and seeds break when a library version changes.

**Short sections cannot be varied.** Two questions gives two orderings, so with three sets two must match. Warn before printing rather than pretending.

### 3.2 Schema

```sql
paper_sets (
  id, paper_id, institute_id, set_label, copies_to_print, created_at,
  unique (paper_id, set_label)
)

paper_set_items (
  id, paper_set_id, institute_id,
  paper_block_id,            -- the block, not the question
  display_position int,
  unique (paper_set_id, display_position)
)

paper_set_options (
  id, paper_set_id, institute_id, paper_question_id, option_order text[]
)

questions.options_shufflable  boolean not null default false
questions.position_locked     boolean not null default false
attempts.paper_set_id         uuid null references paper_sets(id)
attempt_items.display_position int null
```

`attempt_items` stores `question_id`. Display position is recorded beside it for auditing, never as the identity.

### 3.3 Output artefacts

1. N question papers, set letter at 24pt in the header and in every footer, plus the institute's own name and logo.
2. N answer keys, numbered in that set's order, with shuffled option letters where applicable.
3. One master mapping sheet: canonical question number, its position in each set, the answer, the marks.
4. Copies breakdown: 40 students across 3 sets prints 14 / 13 / 13.
5. Distribution note: hand out in a repeating cycle A, B, C along each row.

### 3.4 The failure mode that matters

The student taps numbers off their own sheet. If the app thinks they wrote Set A and they wrote Set C, every tap maps to the wrong question, then the wrong topic, and the weak-spot map is quietly poisoned. Nothing errors.

- Set letter printed large, header and every footer.
- The app asks once, before the question list: "Which set did you write?" No default, cannot be skipped.
- One-tap confirmation: show the first twelve words of question 1 for the chosen set and ask "Is this question 1 on your sheet?"
- Single-set papers skip both screens.
- Teacher override on the paper history screen, remapping the attempt in one transaction and rebuilding any practice set built off the wrong mapping.

---

## 4. Ownership, roles and human-only steps

### 4.1 Who owns what, now

This is the section that inverted in v3.0. Read it carefully, because v2.2 said the opposite and the deck sir was shown reflects v2.2.

**Platform infrastructure — owned by the developer, permanently.**
The GitHub organisation, the Vercel project, the Supabase organisation and both Supabase projects, the domain registration, the Anthropic API account and the R2 backup bucket all sit under the platform's own account. Not under any institute's email. A multi-tenant system cannot have its infrastructure root held by one of its tenants: institute A would hold the delete button for institute B's student data, and no second customer should ever accept that once it is explained to them.

**Institute data — owned by the institute, exportable on demand.**
Each institute owns its members, batches, papers, attempts and private questions. Build the export at C12, not later: a tenant that cannot leave is a tenant that is right to be nervous. A one-click `/institute/export` producing their full data as JSON plus their papers as PDFs is the honest version of the promise v2.2 made through account ownership.

**The migration off sir's account.** v2.2 put GitHub, Vercel, Supabase and the domain under an institute email supplied by sir, explicitly as the mitigation for "the maintainer moves on". Moving them to the platform account takes that mitigation away, and it takes back something already given. Replace it with something real and say so plainly:

- The data export above, available to him at any time without asking.
- A written maintenance window and a stated notice period.
- His institute's private questions stay his. They are never promoted into the shared bank without him saying yes, in writing, per class-subject.

There is a related conversation that is easy to postpone and should not be. Sir's teaching staff are spending real hours on H6b topic granularity, H7 calibration, H8 joint review and H10's review passes. Under §0.1 that work lands in a shared bank that later customers — possibly including a competing institute two kilometres away — read for free. That is a defensible arrangement if he agrees to it, and an indefensible one if he discovers it. Have the conversation before the account migration, and consider what he gets for it: free use in perpetuity, first refusal on new class-subjects, a discount, whatever your friend thinks is fair. The specific answer matters less than it being an agreement rather than a surprise.

**Credential custody.** The platform account is infra root for every tenant. Password manager, 2FA on every service under it, recovery codes stored somewhere your friend can reach and somewhere a second trusted person can reach if he cannot. Never a notes app, never pasted into a chat.

### 4.2 The four roles

v2.2 had three roles and used the word `admin` to mean "can write to the question bank". v3.0 has two unrelated kinds of admin, and reusing that word will eventually produce a real bug. Rename before writing any code.

| Role | Scope | Can |
|---|---|---|
| `platform_owner` | Global | Create institutes, write the shared bank, manage taxonomy, set bank readiness, run migrations, read any tenant through audited functions |
| `institute_admin` | One institute | Invite and remove members, assign teachers to class-subjects, create batches, request activation, export their data. **Never writes the shared bank** |
| `teacher` | One institute, their class-subjects | Generate, print, reprint, flag. Never edits any bank |
| `student` | One institute | Log mistakes, do practice, see their own weak spots |

**Why `institute_admin` gets no bank write access.** The v2.2 argument holds with more force here: the review gate is the only thing standing between a wrong answer key and a parent. A tenant admin who can write to the shared bank can poison every other institute's papers. A tenant admin who can write to their own private layer bypasses review for their own students. Neither is worth the convenience. Institute-private questions are submitted as `staging` and approved by the platform, exactly like everything else.

**How `platform_owner` is stored.** Not as a boolean on `profiles`. It is membership with role `owner` in the platform pseudo-institute (§5.0). One mechanism, one set of policies, one place to audit. A separate boolean would be a second privilege path, and second privilege paths are where privilege escalation lives.

**An institute admin can never grant `platform_owner`.** Assert this as a test that runs as an institute admin and fails the build if it succeeds, not as a note.

### 4.3 How a Google login gets a role

"Continue with Google" authenticates. It carries no role, and the app must never let anyone choose one at signup — no role dropdown, no "I am a teacher" checkbox, no institute-creation form.

The mechanism is a per-institute invite, consulted at the moment of joining:

1. An `institute_admin` (or the platform owner, during manual onboarding) inserts a row into `institute_invites` mapping an email to a role within their institute.
2. That person signs in with Google. The `auth.users` trigger creates a `profiles` row and nothing else. **A new sign-in belongs to no institute.** They land on a "you have no institute yet" screen.
3. They accept the invite, or enter a batch join code. Accepting writes an `institute_members` row with the invited role. A batch join code writes a `student` membership.
4. No invite and no join code means no membership and no access to anything. This is the correct default and it is why `profiles.role` had to go: there is no sensible global role for a person who belongs to nothing.

`institute_invites` is readable and writable only by that institute's admins and the platform owner. If the invite list were reachable from a normal API route it would just be the role dropdown again with extra steps.

Changing an existing member's role is a deliberate, separate action through `set_member_role()`, which writes an audit row. Editing an invite for someone who has already joined changes nothing, by design.

### 4.4 Onboarding an institute, manually

The whole flow, for now. It should take under fifteen minutes and it should be in the runbook.

| # | Step | Who |
|---|---|---|
| 1 | Agree scope: which class-subjects, which batches pilot | Platform + institute |
| 2 | `/platform/institutes/new`: name, slug, contact | Platform owner |
| 3 | Invite the first `institute_admin` by email | Platform owner |
| 4 | Institute admin signs in, accepts, lands in their console | Institute admin |
| 5 | Invite teachers, assign their class-subjects | Institute admin |
| 6 | Activate class-subjects whose `bank_status` is `ready` | Platform owner, on request |
| 7 | Create batches, hand out join codes | Institute admin |

Step 6 stays with the platform owner on purpose. Activation is gated on bank coverage (§7 C11), and a tenant admin cannot evaluate whether the bank is thick enough for their subject. What they get instead is a request button and a visible queue, which is the honest version of "not yet" and far better than a dropdown that silently lists nothing.

### 4.5 Human-only steps

| # | Step | When | Time |
|---|---|---|---|
| H0 | **Platform account setup**: Google account, password manager, 2FA, recovery codes | Before C0 | 45 min |
| H0b | **The conversation with sir** in §4.1, then migrate infra off his email | Before C0 | — |
| H1 | Supabase org, two projects `qbank-dev` and `qbank-prod`, under the platform account | Before C0 | 5 min |
| H2 | Supabase personal access token in shell profile | Before C0 | 2 min |
| H3 | Private GitHub repo, connect to Vercel, under the platform account | Before C0 | 10 min |
| H4 | Google OAuth: consent screen, credentials, redirect URLs | C2 | 45 min |
| H5 | Domain, DNS to Vercel | C2 | 30 min |
| H5b | **Seed the platform institute and your own `owner` membership** before anyone signs in | C2 | 10 min |
| H6a | **Chapter lists for all class-subjects.** Scripted from NCERT indices, human-verified | Before C1 | 3 h |
| H6b | **Topic granularity, per activated class-subject only.** With a teacher who owns that subject | Per activation | 2 h each |
| H7 | **Difficulty calibration, per activated class-subject** | Per activation | 1 h each |
| H8 | **Review 50 questions jointly** with a teacher | Per activation | 1 h each |
| H9 | Print testing on a real institute printer, including a Hindi page and a passage page | C7 | 4 h |
| H10 | Human review, ~1,200 questions per class-subject | Per activation | ~15 h each |
| H11 | Anthropic API key for extraction | C3 | 5 min |
| H12 | **Per-institute onboarding**, §4.4 | Per customer | 15 min |

H6a is scriptable across all 26 class-subjects in an afternoon and is platform-level work done once. H6b, H7 and H8 need a teacher who actually teaches that subject — any institute's teacher will do, which is one of the real benefits of the shared bank.

---

## 5. Data model

### 5.0 Tenancy

Three tables and one seeded row carry the whole model.

```sql
institutes (
  id uuid primary key,
  name text not null,
  slug text unique not null,
  kind text not null,          -- 'platform' | 'institute'
  status text not null,        -- 'active' | 'suspended'
  contact_email text,
  created_at, created_by
)

institute_members (
  institute_id uuid references institutes(id),
  user_id uuid references auth.users(id),
  role text not null,          -- 'owner' | 'institute_admin' | 'teacher' | 'student'
  created_at,
  primary key (institute_id, user_id)
)

institute_invites (
  id uuid primary key,
  institute_id uuid references institutes(id),
  email citext not null,
  role text not null check (role in ('institute_admin','teacher')),
  invited_by uuid, created_at, accepted_at,
  unique (institute_id, email)
)
```

**The platform pseudo-institute.** One row in `institutes` with `kind = 'platform'` and a fixed UUID, seeded in the first migration. The shared bank is owned by it. `platform_owner` is `institute_members` with `role = 'owner'` on it.

This exists so that **every RLS policy has the same shape**. The alternative — a nullable `institute_id` meaning "global" — requires every policy to read `institute_id is null or institute_id = ...`, and a single policy where somebody forgets the null branch leaks either everything or nothing. Nullable tenant keys are where cross-tenant bugs live. Do not use one.

**Helper functions**, all `SECURITY DEFINER`, all used by policies rather than inlined:

```sql
platform_institute_id() returns uuid            -- the fixed constant
my_institutes()         returns setof uuid      -- institutes the caller belongs to
my_role(inst uuid)      returns text
is_platform_owner()     returns boolean
```

**Tenant key on every scoped table.** `institute_id uuid not null`, denormalised, even where it could be derived by joining. Policies must never join to establish tenancy: a join-based policy is one bad migration away from being wrong, and it is slower on every query besides. Where the parent already carries the key, enforce agreement with a composite foreign key so a child cannot land in a different tenant from its parent.

**Global reference tables have no tenant key**, by explicit allowlist: `classes`, `subjects`, `class_subjects`, `strands`, `chapters`, `topics`. Readable by every authenticated user, writable by `platform_owner` only. The CI check in §6.5 fails the build on any new table that is neither on this allowlist nor carrying `institute_id`.

### 5.1 Taxonomy

```sql
classes         (id, name, sort_order)                      -- 9, 10, 11, 12
subjects        (id, name, short_name, script)              -- script: latin | devanagari
class_subjects  (id, class_id, subject_id, bank_status, created_at)
                -- bank_status: planned | seeding | ready
strands         (id, class_subject_id, name, sort_order)
chapters        (id, class_subject_id, strand_id, name, ncert_number, sort_order)
topics          (id, chapter_id, name, slug)

institute_class_subjects (
  institute_id, class_subject_id,
  status,                      -- planned | active
  activated_at, activated_by,
  primary key (institute_id, class_subject_id)
)
```

Chapters hang off `class_subjects`, not `subjects`. Class 11 Physics and Class 12 Physics are different offerings with different chapters.

**Two statuses, and the distinction matters.** `class_subjects.bank_status` is platform-level: how thick the shared bank is for that class-subject. `institute_class_subjects.status` is per tenant: whether that institute has it turned on. An institute can only activate what is `ready`, or what it has enough private questions to carry on its own. Collapsing these into one column is the mistake that makes institute B's dropdown depend on institute A's activation choices.

**One view, used everywhere.** `my_active_class_subjects`, keyed off `auth.uid()`, joining membership to `institute_class_subjects` where status is `active`. No application code filters on status by hand, ever. This is the single control that stops the "empty dropdown makes the app look broken" failure, and it now has to be tenant-aware in exactly one place.

### 5.2 Paper patterns as data

```sql
paper_patterns  (id, owner_institute_id, class_subject_id, name,
                 total_marks, duration_min, origin, is_default)
                 -- origin: board | institute
pattern_sections(id, pattern_id, label, sort_order, instructions,
                 question_count, marks_each, question_types text[],
                 allow_choice bool, practice_eligible bool,
                 requires_stimulus bool)
```

Board patterns are owned by the platform institute and read by everyone. An institute's own unit-test patterns are owned by that institute and read only by it. `practice_eligible` carries the §2.4 decision into the data instead of leaving it in someone's head.

### 5.3 Content

```sql
stimuli (
  id, owner_institute_id, class_subject_id, kind, body, asset_id,
  language, source, status
)   -- kind: passage | case_study | source_extract | map | data_table | diagram

questions (
  id, owner_institute_id,
  class_subject_id, chapter_id, topic_id, strand_id,
  stimulus_id,                -- null for standalone
  parent_question_id,         -- null unless this is 6(a)
  part_label,
  body, question_type,
  options jsonb, correct_option,
  answer, numeric_answer, tolerance, solution, rubric,
  marks, difficulty, language,
  source, source_year,
  status,                     -- staging | approved | rejected | flagged | retired
  options_shufflable, position_locked,
  body_hash, body_normalised, search_tsv, tsv_config,
  created_at, approved_at, approved_by
)

question_assets (id, owner_institute_id, question_id, storage_path, kind, width, height)
question_flags  (id, institute_id, question_id, raised_by, reason, status, resolved_at)
```

`owner_institute_id` is the platform institute for shared questions and a tenant for private ones. The read policy is one predicate, identical everywhere:

```sql
owner_institute_id = platform_institute_id()
or owner_institute_id in (select my_institutes())
```

`question_flags` carries `institute_id` rather than `owner_institute_id`: a flag is raised *by* a tenant *about* a question, and institute A must not see that institute B flagged something. A flag on a shared question is visible to the platform owner and to the raising institute only. A flag never changes the shared question's status directly — that would let one tenant pull a question out of every other tenant's pool. Platform review decides; until then the flag suppresses that question for the raising institute alone.

`body_normalised` is NFC-normalised, whitespace-collapsed text used for hashing and trigram comparison. Without it, Devanagari duplicate detection does not work.

### 5.4 Papers, blocks and sets

```sql
papers        (id, institute_id, teacher_id, batch_id, class_subject_id,
               pattern_id, title, total_marks, duration_min, status,
               seed, generated_at)
paper_sections(id, institute_id, paper_id, pattern_section_id, label, sort_order)
paper_blocks  (id, institute_id, paper_id, section_id, canonical_position,
               stimulus_id, locked)
paper_questions(id, institute_id, paper_id, block_id, question_id,
               within_block_order, marks, is_choice_alternative)
paper_sets    (id, institute_id, paper_id, set_label, copies_to_print, created_at)
paper_set_items(id, institute_id, paper_set_id, paper_block_id, display_position)
paper_set_options(id, institute_id, paper_set_id, paper_question_id, option_order text[])
```

A standalone question is a block of one. A passage with eight questions is a block of eight. Selection, shuffling and printing all operate on blocks.

Note that `paper_questions.question_id` may point at a platform-owned or an institute-owned question, but `institute_id` on the row is always the institute that generated the paper. A paper never crosses tenants even though the bank does.

### 5.5 People and activity

```sql
profiles         (id → auth.users, email, full_name, created_at)
                 -- NO role column. Roles live in institute_members
institute_members(institute_id, user_id, role, created_at)
institute_invites(id, institute_id, email, role, invited_by, created_at, accepted_at)
teacher_subjects (institute_id, teacher_id, class_subject_id)
batches          (id, institute_id, name, class_subject_id, teacher_id, join_code, active)
enrolments       (institute_id, batch_id, student_id, joined_at,
                  unique (institute_id, student_id, class_subject_id))
attempts         (id, institute_id, paper_id, student_id, paper_set_id, logged_at, source)
attempt_items    (id, institute_id, attempt_id, question_id, is_correct, display_position)
practice_sets    (id, institute_id, student_id, attempt_id, class_subject_id, built_at, status)
practice_set_items(id, institute_id, practice_set_id, question_id, position,
                  is_done, self_marked_correct)
question_exposure(institute_id, student_id, question_id, first_seen_at, context)
coverage_gaps    (id, institute_id, class_subject_id, topic_id, difficulty, detected_at, note)
role_audit       (id, institute_id, actor, target, old_role, new_role, at)
platform_access_log (id, actor, institute_id, action, target_table, target_id, at)
```

**`profiles.role` is gone.** This is the schema break that cannot be deferred. A single global role column assumes one institute per person, and coaching teachers routinely work at two. Keeping it and adding memberships alongside gives two sources of truth for authorisation, which is worse than either alone.

**Join codes are unique per institute, not globally**, but generate them globally unique anyway — a student typing a code should never land in the wrong institute because two institutes independently generated `K7M2QX`.

**Enrolment uniqueness is now `(institute_id, student_id, class_subject_id)`.** A student may be in Class 11 Physics at one institute and, in principle, at another. Rare, but the constraint should express the real rule rather than a convenient one.

`question_exposure` is tenant-scoped even for platform-owned questions: a student's exposure history belongs to their institute, and a question served at institute A must remain servable at institute B.

### 5.6 Indexes

Every tenant-scoped index leads with `institute_id`. A policy that filters on it and an index that does not is how the first slow query happens.

```sql
create index on questions (owner_institute_id, status, class_subject_id, chapter_id, difficulty, marks);
create index on questions (owner_institute_id, class_subject_id) where status = 'approved';
create index on questions using gin (search_tsv);
create index on questions using gin (body_normalised gin_trgm_ops);
create index on questions (stimulus_id) where stimulus_id is not null;
create index on attempt_items (institute_id, question_id);
create index on attempts (institute_id, student_id, paper_id);
create index on question_exposure (institute_id, student_id, question_id);
create index on paper_set_items (institute_id, paper_set_id, display_position);
create index on chapters (class_subject_id, sort_order);
create index on institute_members (user_id);
create index on institute_class_subjects (institute_id, status);
```

Use the `simple` text search configuration for Devanagari rows. Store which configuration was used per row in `tsv_config` so the query side matches.

### 5.7 Row level security

Every rule from v2.2 still applies, with tenancy added above it. Write them as SQL tests that run as each role and assert row counts, not as a note in a README.

1. **Tenant isolation, first and hardest.** For every tenant-scoped table, a member of institute A sees zero rows belonging to institute B. Test every table in both directions.
2. A student reads only their own `attempts`, `attempt_items`, `practice_sets`, `question_exposure`, within their institute.
3. A question's `solution`, `answer` and `rubric` are readable only after that student has an attempt on a paper containing it, or an unlocked practice item for it. `can_read_solution(question_id)`, `SECURITY DEFINER`, never a client-side filter.
4. **Bank reads** follow the single predicate in §5.3. **Bank writes** are `platform_owner` only, for both the shared bank and institute-private questions. Teachers and institute admins may insert into `question_flags` and nothing else.
5. Papers are scoped through `enrolments` and through `institute_id`. A Class 11 Physics student cannot read a Class 12 Chemistry paper, and cannot read another institute's Class 11 Physics paper.
6. A teacher reads and generates only for class-subjects in their `teacher_subjects`, within the institute that membership belongs to.
7. `institute_invites` is readable and writable by that institute's admins and the platform owner only.
8. `institute_members.role` is not updatable through RLS by anyone, including the platform owner. Changes go through `set_member_role(institute_id, target_email, new_role)`, `SECURITY DEFINER`, which writes a `role_audit` row. There must be no `UPDATE institute_members SET role` reachable from any API route.
9. `institute_admin` may set roles only within their own institute, and only to `teacher` or `student`. Granting `institute_admin` requires the platform owner. Granting `owner` on the platform institute is impossible through this function at all.
10. `institutes` rows are insertable only by `create_institute()`, `SECURITY DEFINER`, platform owner only.

### 5.8 Platform access to tenant data

The platform owner will need to see tenant data to support it. This is the largest RLS surface in the system and the easiest to get quietly wrong, so it is constrained deliberately.

**No blanket policy.** Do not write `or is_platform_owner()` into every table's policy. One bug in a shared query path then leaks every tenant at once rather than one row, and there is no record of who looked at what.

**Audited functions instead.** Specific `SECURITY DEFINER` functions — `platform_inspect_institute(inst)`, `platform_inspect_paper(paper)` — that return exactly the shape the console needs and write a `platform_access_log` row on every call. Reads are visible in the log, which is also what makes them defensible to a customer who asks.

**No impersonation in v1.** No "act as this tenant" button. It is the most abused feature in multi-tenant products, it is a large surface, and at one customer it saves nothing that a read-only inspector does not. Revisit at customer five, with a reason.

---

## 6. Giving Claude Code direct database control

Mostly unchanged from v2.2, with one change of posture that matters.

**What multi-tenancy changes.** With one institute, an agentic session with database write access had a blast radius of one bank and one school's data. Across tenants, the same session touches every customer. A `DELETE` with a wrong `WHERE` is no longer an embarrassing evening, it is a multi-customer data incident with a disclosure obligation. Nothing about the tooling changes; the tolerance does.

Concretely: manual tool approval stays on permanently, not just for the first few sessions. The MCP server never points at production with write access. Ingestion sessions work against `qbank-dev` and reviewed output is promoted by migration or by a service-role script you read first.

### 6.1 Access paths

| Path | Use for | Environment |
|---|---|---|
| Local Supabase CLI, full Postgres in Docker | Schema iteration, RLS work, destructive experiments, tests | Local only |
| Supabase MCP server, project-scoped | Schema inspection, queries, migrations, type generation, logs | Dev project only |
| Migration files via `supabase db push` | Every change reaching production | Prod |
| Service-role Node scripts | Bulk work: imports, backfills, nightly dumps | Dev and prod |

**Do not point the MCP server at production with write access.** An agent with write tools on the live database is one prompt-injected scanned page away from a bad afternoon, and it is now other people's data as well as the bank. If you want MCP against prod, attach it read-only with `&read_only=true`.

### 6.2 MCP configuration

`.mcp.json` at the repo root:

```json
{
  "mcpServers": {
    "supabase-dev": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=${SUPABASE_DEV_REF}&features=database,docs,development,debugging"
    }
  }
}
```

- The hosted HTTP endpoint is the current path. The older stdio setup connects but frequently fails tool discovery, and `--access-token` as a CLI flag no longer works.
- `project_ref` scoping removes account-level tools. That is intended.
- Trimming `features` cuts the tool count and the injection surface.
- Authenticate with `/mcp` in Claude Code.

### 6.3 Environment

`.env.local`, gitignored, never committed, never pasted into a chat:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # server only, bypasses RLS AND tenancy, treat as root
SUPABASE_DB_URL=
SUPABASE_DEV_REF=
SUPABASE_PROD_REF=
ANTHROPIC_API_KEY=
PLATFORM_INSTITUTE_ID=          # the fixed pseudo-institute UUID
```

The **production** service role key should not exist on the development machine. Vercel environment variables and GitHub Actions secrets only. Note what the comment now says: the service role key bypasses tenancy as well as RLS, so every server route using it must filter by `institute_id` explicitly. That is the one place tenant isolation is not enforced for you.

### 6.4 CLAUDE.md

```markdown
# Project rules

## Tenancy

- This is a multi-tenant application. Every row of tenant data belongs to
  exactly one institute. There is no "global" tenant and no null
  institute_id — the shared question bank is owned by a real row in
  `institutes` with kind='platform'.
- Every new table is either tenant-scoped with `institute_id uuid not null`,
  or on the global reference allowlist (classes, subjects, class_subjects,
  strands, chapters, topics). There is no third option. CI enforces this.
- RLS policies must never establish tenancy by joining to a parent table.
  Filter on the row's own institute_id.
- Any server code using the service role key bypasses tenancy. It MUST
  filter by institute_id explicitly. Treat a service-role query with no
  institute_id predicate as a bug, every time.
- NEVER add `or is_platform_owner()` to a table policy. Platform access to
  tenant data goes through the audited functions in section 5.8.

## Database

- The database is the product. The question bank represents hundreds of hours
  of irreplaceable human review, and it now also holds other people's
  students. Treat every write as if it cannot be undone.
- NEVER run `supabase db reset` against anything but the local stack.
- NEVER run DELETE or TRUNCATE without a WHERE clause. If a task seems to
  need one, stop and ask.
- NEVER run DDL against production. Production schema changes go through
  migration files applied by `supabase db push`, reviewed by a human first.
- Every schema change is a migration file in `supabase/migrations/`, named
  `<timestamp>_<verb>_<object>.sql`. No dashboard edits, ever.
- Every migration includes its down SQL as a trailing comment block.
- Every new table gets RLS enabled in the same migration that creates it.
- After any schema change:
  `supabase gen types typescript --local > src/lib/database.types.ts`
- Before any bulk data operation:
  `pg_dump "$SUPABASE_DB_URL" -Fc -f backups/pre-<task>-$(date +%s).dump`

## Scope

- The app supports classes 9-12 and subjects PCMB, Social Science, English,
  Hindi. Never hardcode a class, a subject, a chapter or a paper pattern.
  If you find yourself writing `if (subject === 'Biology')`, stop.
- Only class-subjects active FOR THE CURRENT INSTITUTE appear in
  teacher-facing UI. Read them from `my_active_class_subjects`. Never
  filter on status by hand.
- Text handling must be script-agnostic. Devanagari rows use the `simple`
  text search configuration and NFC normalisation.

## Roles

- Four roles: platform_owner, institute_admin, teacher, student. The word
  "admin" alone is ambiguous in this codebase — never use it unqualified
  in a variable name, a route, a policy or a comment.
- platform_owner is membership with role='owner' on the platform institute.
  It is NOT a boolean on profiles. Do not add one.
- Sign-in is Google OAuth only and carries no role and no institute. A new
  user belongs to nothing until they accept an invite or enter a join code.
- Never build a role selector, a role field on a signup form, an "I am a
  teacher" checkbox, or a public institute-creation form.
- NEVER write an API route, server action, or RPC that updates
  institute_members.role. Changes go through set_member_role, which writes
  an audit row.
- institute_admin must never gain write access to questions or stimuli, for
  the shared bank or their own private layer. The review gate is the only
  thing between a wrong answer key and a parent, and it is now between one
  tenant's mistake and every other tenant's papers.

## Code

- TypeScript strict mode. No `any`, no `@ts-ignore`.
- All database access through generated types.
- Anything touching the service role key is server-side only.
- No client-side query may return solution, answer or rubric. Those come
  from a server route that checks the attempt gate.
- The current institute is resolved server-side from the session on every
  request. Never from a URL parameter, a cookie, or client state. A route
  that takes institute_id from the client is a tenancy bug even if RLS
  would have caught it.

## Working style

- Read `docs/BUILD-PLAN.md` before starting a checkpoint.
- Do not start work on a later checkpoint because it seems related.
- When a requirement is ambiguous, ask once and stop.
- Write tests before implementation for the paper generator, the shuffle
  engine, the practice matcher and every RLS policy. Those are where silent
  wrongness lives.
```

### 6.5 Guardrails

- Branch protection on `main`, so migrations reach prod through a PR you read.
- A pre-push hook failing on `DROP TABLE`, `TRUNCATE`, or `DELETE FROM` without `WHERE` in any staged `.sql`.
- **A tenancy lint that fails the build**: every table in the `public` schema either has an `institute_id` or `owner_institute_id` column, or appears in an explicit allowlist file. New table, no tenant key, no allowlist entry, red CI. This is the single cheapest control in the whole plan and it catches the failure mode that matters most.
- **A grep test** failing the build if `or is_platform_owner()` appears inside a `create policy` statement.
- `pg_dump` before every prod migration, automated, artefact retained 30 days.
- A `qbank-dev` project seeded with synthetic questions **across at least three institutes**, so tenancy bugs surface in development rather than in front of a customer. A single-tenant dev database will pass every test a multi-tenant bug would fail.

---

## 7. Checkpoints

One checkpoint per Claude Code session. Run the acceptance commands yourself. Commit and tag at each one.

---

### C0 · Repo, environment, database control [3 h]

**Goal:** Claude Code can inspect the schema, write a migration, apply it locally, and regenerate types, without you touching a dashboard.

**Acceptance**
```bash
supabase status
npm run typecheck
psql "$SUPABASE_DB_URL" -c '\dt'
git push                     # hook runs, CI green
```
`/mcp` in Claude Code shows `supabase-dev` connected with database tools listed.

**Prompt**

```text
Set up a new project. Infrastructure only, no application logic.

Stack: Next.js 15 App Router, TypeScript strict, Tailwind, Supabase.
Deploy target Vercel. Package manager npm.

1. Scaffold the Next.js app at the repo root, strict TypeScript, `any`
   disallowed in the config.

2. Initialise Supabase locally with `supabase init` and start the local
   stack. Report the local anon key and DB URL.

3. Create `.env.local.example` with these keys and no values:
   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
   SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL, SUPABASE_DEV_REF,
   SUPABASE_PROD_REF, ANTHROPIC_API_KEY, PLATFORM_INSTITUTE_ID.
   Add `.env.local` and `backups/` to .gitignore.

4. Create `.mcp.json` for the hosted Supabase MCP server over HTTP at
   https://mcp.supabase.com/mcp with project_ref from ${SUPABASE_DEV_REF}
   and features limited to database,docs,development,debugging.

5. Create `CLAUDE.md`. I will paste the contents. Ask me for them, do not
   invent your own version.

6. Create `scripts/db-guard.sh`: scan staged .sql files, exit non-zero on
   DROP TABLE, TRUNCATE, or DELETE FROM without a WHERE. Wire into a
   pre-push hook with husky.

7. Create `scripts/tenancy-lint.ts`: query information_schema for every
   base table in the public schema, and fail if any lacks both
   institute_id and owner_institute_id unless it is listed in
   `docs/global-tables.txt`. Seed that file with: classes, subjects,
   class_subjects, strands, chapters, topics, institutes, profiles.
   Also fail if the string "is_platform_owner()" appears inside any
   `create policy` block in supabase/migrations.

8. Create `.github/workflows/ci.yml` running on every PR: npm ci,
   typecheck, lint, test, `supabase db lint`, and scripts/tenancy-lint.ts.
   No deploy step yet.

9. Folder structure: src/app, src/components, src/lib, src/lib/db,
   src/server, supabase/migrations, supabase/tests, scripts, docs.

10. `src/lib/db/client.ts` (browser, anon key) and `src/lib/db/admin.ts`
    (server-only, service role, with a runtime guard that throws if imported
    into a client component).

11. Install and self-host fonts for both scripts now rather than later:
    a Latin serif and sans, and Noto Sans Devanagari. Not from a CDN,
    because print must not depend on a network fetch.

Create no tables. Report the exact commands I run to verify each item.
```

---

### C1 · Schema, tenancy, RLS, taxonomy [9 h]

**Goal:** The full multi-tenant, multi-class, multi-subject schema exists as migrations, RLS is on and tested in both directions across tenants, and chapter lists for all 26 class-subjects are seeded.

**Depends on:** C0, H6a

**Was 6 h in v2.2.** The extra three hours are tenancy: the institutes tables, the helper functions, denormalised keys with composite foreign keys, and roughly doubling the RLS test suite.

**Acceptance**
```bash
supabase db reset
psql "$SUPABASE_DB_URL" -f supabase/tests/rls.test.sql
psql "$SUPABASE_DB_URL" -f supabase/tests/tenancy.test.sql
npx tsx scripts/tenancy-lint.ts
psql "$SUPABASE_DB_URL" -c "select bank_status, count(*) from class_subjects group by 1"
npm run typecheck
```

**Prompt**

```text
Build the complete database schema as migrations. Read sections 5.0 to 5.8
of docs/BUILD-PLAN.md first and follow them exactly. Where you disagree with
the plan, follow it and tell me where you disagreed.

Migration files in supabase/migrations, in this order: tenancy, taxonomy,
patterns, content, papers_blocks_sets, activity, indexes, rls.
Each with down SQL as a trailing comment block.

1. Tenancy first, per section 5.0. institutes, institute_members,
   institute_invites. Seed exactly one row with kind='platform' and a
   fixed UUID read from an environment variable, in the migration itself
   so every environment has the same one.

   Helper functions, all SECURITY DEFINER, all STABLE:
   platform_institute_id(), my_institutes(), my_role(inst),
   is_platform_owner().

2. Every tenant-scoped table gets institute_id uuid not null. Bank tables
   (questions, stimuli, question_assets, paper_patterns) get
   owner_institute_id instead. Where a child's tenant must match its
   parent's, enforce it with a composite foreign key, not a trigger.
   Do not use a nullable institute_id to mean "global" anywhere.

3. No role column on profiles. Roles are institute_members rows. If you
   find yourself wanting a global role, that is the thing this schema
   exists to prevent.

4. Taxonomy per 5.1. Chapters hang off class_subjects. class_subjects has
   bank_status (planned|seeding|ready), platform-level.
   institute_class_subjects has status (planned|active), per tenant.
   Build the view `my_active_class_subjects` keyed off auth.uid(). No
   application code will filter on status by hand.

5. Social Science, classes 9 and 10, uses strands. Classes 11 and 12 use
   separate subjects. Model both without a special case in the query layer.

6. Blocks: paper_blocks sits between paper_sections and paper_questions.
   Nothing in the schema should permit a question to belong to a paper
   without belonging to a block.

7. Enrolment: unique (institute_id, student_id, class_subject_id).

8. Teacher scoping: teacher_subjects, carrying institute_id. RLS must
   prevent a teacher reading or generating for a class-subject they are
   not assigned, in the institute that assignment belongs to.

9. Role mutation:
   - create_institute(name, slug, contact_email, first_admin_email)
     SECURITY DEFINER, callable only when is_platform_owner(). Creates the
     institute and the first institute_invites row in one transaction.
   - set_member_role(institute_id, target_email, new_role) SECURITY
     DEFINER. Platform owner may set any role in any institute.
     institute_admin may set only 'teacher' or 'student', only within
     their own institute. Nobody may set 'owner' on the platform
     institute through this function. Writes a role_audit row every time.
   - accept_invite(invite_id) SECURITY DEFINER, matching the caller's
     verified email case-insensitively, writing institute_members and
     stamping accepted_at.
   - The auth.users insert trigger creates the profiles row and NOTHING
     else. No institute, no role.
   Do not create any other route, action or RPC that touches
   institute_members.role.

10. Text handling: questions.body_normalised is NFC-normalised and
    whitespace-collapsed, maintained by a trigger. search_tsv uses
    `english` for latin-script rows and `simple` for devanagari, chosen
    from subjects.script, with the choice stored in tsv_config.

11. The marks-per-position constraint from section 3.1: for a given paper,
    every display_position must carry the same marks value across all
    paper_sets. A trigger that fails loudly at insert.

12. RLS on every table, in the same migration that creates it, per
    section 5.7. Rule 3 is a SECURITY DEFINER function
    can_read_solution(question_id uuid) returns boolean.
    Section 5.8's platform access functions:
    platform_inspect_institute(inst) and platform_inspect_paper(paper),
    both writing platform_access_log rows. No blanket is_platform_owner()
    branch in any table policy.

13. All indexes from section 5.6, tenant key first.

14. supabase/tests/tenancy.test.sql. Seed three institutes: the platform
    one plus two tenants, each with an admin, a teacher and two students.
    Then, for EVERY tenant-scoped table, assert as a member of institute A
    that zero rows of institute B are visible. Enumerate the tables from
    information_schema so a new table added later without a test fails
    here rather than passing silently. Also assert:
    - a teacher at institute A and institute B sees both memberships and
      only the right data under each
    - an institute_admin cannot set any role at another institute
    - an institute_admin cannot grant institute_admin or owner
    - an institute_admin cannot insert, update or delete questions or
      stimuli, including rows whose owner_institute_id is their own
    - a tenant of any role sees zero rows from another institute's
      institute_invites
    - create_institute called by an institute_admin fails
    - a question flagged by institute A remains in institute B's eligible
      pool

15. supabase/tests/rls.test.sql, everything from v2.2 plus tenancy:
    - a student sees zero rows of another student's attempt_items
    - a student cannot read solution/answer/rubric for a question they
      have no attempt on
    - a teacher update to questions fails
    - a student cannot read a paper from a class-subject they are not
      enrolled in
    - a teacher cannot read or generate for a class-subject not in their
      teacher_subjects
    - a direct `update institute_members set role='owner'` fails as
      student, teacher, institute_admin and platform owner
    - set_member_role called as teacher fails; called correctly writes a
      role_audit row
    - a new auth.users insert lands with a profiles row and zero
      institute_members rows

16. scripts/seed-taxonomy.ts reads docs/taxonomy/*.csv, one file per
    class-subject, columns: strand, chapter_number, chapter_name. Upserts
    classes, subjects, class_subjects (bank_status='planned'), strands and
    chapters. Idempotent. Topics are seeded separately, per activation.

17. scripts/seed-patterns.ts seeds paper_patterns and pattern_sections
    from docs/patterns/*.json, all owned by the platform institute.
    Include at minimum: CBSE Class 10 Science, CBSE Class 12 Biology,
    CBSE Class 10 Social Science, CBSE Class 10 English, and a generic
    institute unit test pattern parameterised by total marks.

Run `supabase db reset` for a clean apply from empty, then both test files,
and paste all output.
```

**Acceptance, done by hand.** Read `tenancy.test.sql` yourself before trusting it. An enumerated test that silently enumerates zero tables passes beautifully.

---

### C2 · Auth, membership, batches, enrolment [7 h]

**Goal:** People sign in, join an institute by invite or join code, land on the right shell for their role in that institute, and a student can join one batch per subject.

**Depends on:** C1, H4, H5, H5b

**Was 4 h in v2.2.** The extra three hours are the invite and join flow, the no-institute state, and the institute switcher for people who belong to more than one.

**Prompt**

```text
Build authentication, membership and batch enrolment.

1. Supabase Auth, Google OAuth only. No email/password, no magic links.
   One sign-in button: "Continue with Google". Everyone uses the same
   button, including the platform owner.

2. A new sign-in belongs to no institute. Build /welcome: it lists any
   pending institute_invites matching the verified email, with an Accept
   button per invite, and a "join a batch with a code" field. If there is
   neither, it says plainly that they need an invite or a code from their
   institute, and offers nothing else. No signup form, no institute
   creation, no role selection anywhere on this screen.

3. Institute context. A person may belong to several institutes. Resolve
   the current institute server-side on every request from the session,
   never from a URL parameter or client state. Where someone belongs to
   more than one, show a switcher in the app bar; where they belong to
   one, show the institute name and no control.

4. Middleware routing, by role IN THE CURRENT INSTITUTE:
   /platform/*   requires is_platform_owner()
   /institute/*  requires institute_admin
   /teacher/*    requires teacher or institute_admin
   /app/*        requires any membership
   Unauthorised access returns 404, not 403. Do not leak the route map.

4b. Role and institute are read server-side on every request. Never trust
    a role claim from a JWT custom claim, a cookie, or client state.

5. Institute admin console at /institute:
   - /institute/members: list members with role and join date; invite by
     email with a role of teacher or student; revoke an invite; remove a
     member; change a member's role between teacher and student via
     set_member_role. Changing a role requires typing the target email to
     confirm. The role dropdown must not offer institute_admin or owner.
   - /institute/teachers: assign class-subjects to each teacher, from
     my_active_class_subjects only.
   - /institute/subjects: the institute's class-subjects with their
     status, and a "request activation" button for planned ones that
     writes an activation_requests row. Read-only otherwise. Explain in
     one line why a subject is not yet available rather than hiding it.

6. Teacher batch management at /teacher/batches:
   - create a batch, choosing from that teacher's assigned class-subjects
     only, read from my_active_class_subjects
   - join code: 6 characters, uppercase alphanumeric, no O, 0, I or 1,
     globally unique across all institutes
   - rotate the code, invalidating the previous one atomically
   - list enrolled students with join dates

7. Student join at /app/join: enter code, see the INSTITUTE NAME, batch
   name and subject echoed back, confirm, join. Echoing the institute name
   is not decoration — it is what stops a student joining the wrong
   institute from a mistyped code. A student may hold at most one batch
   per class-subject per institute; a second attempt shows which batch
   they are already in and offers to switch. Enforce in the database.

8. Student subject switcher. A Class 11 student may be in Physics,
   Chemistry, Maths and English batches. The student shell needs a subject
   context that persists across navigation, defaulting to the subject with
   the most recent unlogged paper.

9. App shells: teacher shell matching the left rail in
   teacher-app-demo.html, student shell matching the bottom tab bar in
   student-app-demo.html, with the subject switcher added to the student
   app bar and the institute name in both. Structure only, no real data.

Integration tests:
- an invited email signs in, accepts, and lands with the invited role
- an uninvited email signs in and lands on /welcome with no access
- a student hitting /teacher, /institute and /platform gets 404
- a teacher hitting /institute and /platform gets 404
- an institute_admin hitting /platform gets 404
- a person in two institutes sees the right role and data under each
- a join code from institute B, entered by a member of institute A,
  enrols them in institute B correctly and does not leak A's data into
  that session
- no route in the codebase writes institute_members.role except
  set_member_role. Assert with a grep-based test that fails the build if
  a new one appears.

Show me the output.
```

**Acceptance, done by hand**

Sign in with a throwaway Google account with no invite. Confirm it lands on `/welcome` with nothing to do, and that `/teacher`, `/institute` and `/platform` all return 404. Invite it as a teacher at one institute, accept, and confirm it sees that institute and nothing of the other. Do this yourself. It is the control that protects both the bank and every tenant, and it is worth ten minutes.

---

### C2b · Platform console [6 h]

**Goal:** Your friend can run the whole platform from a screen instead of from psql.

**Depends on:** C2

**New in v3.0.** This is the checkpoint that replaces "the maintainer runs some SQL". At one institute that was fine. At three it is a support queue, and a support queue served by hand-written UPDATE statements against a live multi-tenant database is how someone eventually updates the wrong tenant.

**Prompt**

```text
Build the platform console at /platform. Platform owner only, enforced by
middleware and by RLS. Read section 5.8 of docs/BUILD-PLAN.md first:
every read of tenant data goes through the audited inspect functions, and
there is no impersonation feature in this checkpoint.

1. /platform/institutes
   List: name, slug, status, member counts by role, active class-subjects,
   last activity, row counts. Create form calling create_institute, which
   is the ONLY path that creates a tenant. Suspend and reactivate.

2. /platform/institutes/[id]
   Read-only inspector via platform_inspect_institute. Members, batches,
   recent papers, activation status. No edit controls except suspend and
   role changes through set_member_role. Every load writes a
   platform_access_log row, and the screen says so in one line at the
   bottom, because a customer will eventually ask.

3. /platform/bank
   The C4 review queue, platform-wide. Staging questions grouped by
   class-subject and by owner institute, with body, answer, marks,
   difficulty and any note from the ingestion session. Approve, reject and
   edit. Institute-private staging questions appear here too and are
   clearly marked with their owner, because the platform reviews those as
   well and must never approve one into the shared bank by accident.
   Promoting a private question to the shared bank is a separate,
   explicit action with a confirmation naming the owning institute.

4. /platform/activation
   A matrix: class-subject down, institute across. Cells show planned or
   active. Alongside it, per class-subject: bank_status, approved question
   count, thinnest chapter, thinnest topic, and whether the C11 gate is
   met. Activating for an institute is one action here and writes
   institute_class_subjects.

5. /platform/requests
   activation_requests raised at /institute/subjects, oldest first, with
   the institute, the class-subject, and the gate status for it. Approve
   (which activates) or decline with a reason the institute admin sees.
   This queue is the honest version of "not yet" and it is why the
   institute's dropdown is never mysteriously empty.

6. /platform/support
   The operations that were manual SQL in v2.2, as real actions, each in
   one transaction, each writing platform_access_log:
   - correct a student's chosen paper set, remapping attempt_items and
     rebuilding the affected practice set
   - retire a question from circulation, with a reason
   - resolve a question_flag
   - move a student between batches
   - resend or revoke an invite
   Each one needs a confirmation naming the institute and the person.

7. /platform/health
   Extends the C12 health checks with per-institute row counts and storage
   use, so one runaway tenant is visible before the free-tier ceiling is.

8. /platform/audit
   role_audit and platform_access_log, filterable by institute and actor,
   newest first. Exportable as CSV.

No impersonation. No "act as tenant" button. No blanket cross-tenant
queries — if a screen here needs tenant data, it calls an inspect function
and that call is logged.

Tests:
- every /platform route returns 404 for student, teacher and
  institute_admin
- platform_inspect_institute writes exactly one log row per call
- create_institute is the only code path inserting into institutes
- the set correction action leaves attempt_items, practice_sets and
  question_exposure mutually consistent, asserted after a deliberate
  wrong-set scenario
```

---

### C3 · Question ingestion, agentic [prep 2 h, then ongoing per batch]

**What this actually is.** Not a pipeline of scripts. A Claude Code session, given a folder of scanned pages and dev database write access, reads each page, extracts the questions, tags them against the taxonomy already in the database, crops and stores any diagrams, checks for near-duplicates by querying the bank itself, and inserts. One long agentic run per batch of source material.

**Unchanged from v2.2 except for one line in the brief**: everything now carries an explicit `owner_institute_id`, and the session must be told which one. Getting this wrong puts one institute's private material into the shared bank, where every other institute reads it. That is the ingestion failure that matters now.

The only infrastructure this checkpoint builds in advance is the guardrail: **everything lands as `status = 'staging'`, never `approved`**, enforced by the database, not by the session's good behaviour. C4 moves staging rows to approved.

**Depends on:** C1, H7, H11

**Prep, one time**

- `docs/ingest-instructions.md`: the standing brief below, in the repo so it does not get retyped. Re-paste it every session; do not assume a new session remembers the last one.
- Confirm the check constraint from C1 actually rejects an `approved` insert from a non-review context. Test this once, by hand, before trusting any session with it.
- Confirm that an insert with no `owner_institute_id` is rejected outright rather than defaulting to anything.

**Acceptance, per batch**
```sql
select owner_institute_id, status, count(*) from questions
where class_subject_id = '<the one just ingested>'
group by 1, 2;
-- everything is 'staging', and the owner is the institute you intended.
```

**The standing brief** (paste at the start of every ingestion session)

```text
You have direct write access to the Supabase database via the MCP server
(project-scoped, dev). Read CLAUDE.md before doing anything.

Task: extract questions from the scanned pages in <folder>, for
<class-subject>, and load them into the bank.

OWNERSHIP: every row you insert must have
owner_institute_id = <the platform institute UUID, or a specific
institute's UUID>. I am telling you explicitly which one for this batch:
<value>. If a page appears to come from a different source than I have
told you, stop and ask. Do not infer ownership from the material.

For each page or page group:

1. Read the image. Identify every question on it. If a passage, case
   study, source extract, map or data table is followed by several
   questions, treat it as one block: extract the stimulus once, and link
   every question under it via stimulus_id, preserving their order.
   Multi-part questions (6a, 6b, 6c) link to a parent via
   parent_question_id and part_label.

2. For each question, extract: body, question_type, options (if any),
   correct_option, answer, numeric_answer and tolerance (if numerical),
   solution if the source shows working, rubric (if it's a writing task
   with no single answer), marks, source, source_year.

3. Tag it: query the chapters and topics tables for this class_subject and
   pick the closest match. If nothing fits well, say so rather than
   forcing a tag — write it with topic_id null and a note, don't guess.

4. Set difficulty (easy/medium/hard) using your own judgement against the
   question's demand, informed by its marks and type.

5. Set options_shufflable: false by default. Set it true only if you are
   confident no option is self-referential ("all of the above", "both A
   and C") and there's no numeric or chronological ordering among them.

6. If there's a diagram or map, crop it from the source page, save it,
   upload to Supabase Storage, and write a question_assets row.

7. Before inserting, query the questions table for anything with high text
   similarity, scoped to this class_subject first, ACROSS ALL OWNERS. A
   question already in the shared bank should not be re-inserted as an
   institute-private duplicate. Note matches in your summary instead.

8. Insert with status = 'staging'. Nothing you write should ever be
   'approved'.

If something is illegible, ambiguous, or you're materially unsure about
the correct answer, insert it anyway but note it plainly in your
end-of-run summary rather than silently guessing.

At the end: how many questions inserted, under which owner, how many
diagrams, duplicates skipped, anything you were unsure about, and which
chapters got covered.
```

**Notes for running it well**

- 60-100 pages a session keeps the session coherent and the summary meaningful. Don't hand it 500 pages.
- Hindi sources: expect a higher "unsure" rate. Say so up front.
- Treat the first batch of any class-subject as a calibration run before committing to how many batches it will take.

---

### C4 · Getting staged questions to approved [ongoing]

**What this actually is.** You skim what a C3 session inserted, in batches, and flip good ones to `approved`. In v3.0 this happens at `/platform/bank` (C2b) rather than in psql, because it is now a recurring queue across institutes rather than an occasional job on one bank.

**What you're looking for when skimming** (skim speed, not 45-seconds-per-question scrutiny):

- Does the answer actually match the question. This is the one that would embarrass you in front of a parent — now somebody else's parent.
- The owner is right. A private question sitting in the shared bank is a content-licensing problem and a competitive one.
- Diagrams present where the question needs one, and not obviously mis-cropped.
- Marks in a sane range for the question type.
- Anything the session flagged as unsure or a probable duplicate — check those specifically, skim the rest lighter.

**The Claude Code path still works** and is often faster for a batch you just ingested, because the model that wrote the extraction can explain its own uncertain calls:

```text
Show me everything you just inserted with status='staging' from this
session, grouped by chapter, with the body, answer and any note you left.
```

Then approve the batch minus the ones you flagged. Either path is fine. What stays true regardless: nothing reaches `approved` except through a step you performed, looking at what was extracted.

**Acceptance.** Run one real batch of 30-50 questions through C3 and this flow, and time yourself. Over 20-30 minutes means C3's extraction quality needs tightening, not this step.

---

### C5 · Paper generator [6 h]

**Goal:** Filters in, a valid balanced paper out for any class-subject and pattern, or an honest failure naming what ran short.

**Depends on:** C1, plus enough approved questions to test against

**Unchanged from v2.2 except for the eligible pool**, which now spans two owners.

**Acceptance**
```bash
npm test -- generator
```

**Prompt**

```text
Build the paper generation engine. Pure functions in src/server/generator/,
no UI in this checkpoint.

Input:
  institute_id, class_subject_id, pattern_id, chapter_ids[],
  strand_weights (optional), difficulty_split {easy, medium, hard},
  exclude_recent_papers (default 3), teacher_id, batch_id, seed

The pattern drives structure. Never hardcode a section layout, a mark
total or a subject name anywhere in this module.

Algorithm:

1. Eligible pool: status 'approved', matching class_subject and chapters,
   with owner_institute_id in (platform, this institute), minus every
   question in this teacher's last N papers for this class-subject, minus
   any question this institute has an open flag on.

   The pool spans two owners. A generated paper may mix shared and
   private questions freely — that is the point of the private layer.
   It must never contain a question owned by a third institute. Assert
   this in a test, because RLS will already prevent it and a test that
   passes only because RLS caught it is not testing the generator.

2. Selection operates on BLOCKS, not questions. A stimulus with eight
   questions is selected or not as a unit, and consumes eight slots. A
   section requiring a stimulus may only draw stimulus blocks; a section
   that does not must not draw them.

3. Fill each pattern section against its count and marks. Section
   structure is a hard constraint; difficulty is soft.

4. Difficulty is a weighted draw, landing within 5 percentage points of
   target across the whole paper. If it cannot, that is a failure.

5. Strand balance for Social Science: respect strand_weights within 10
   percentage points, above the topic-spread rule.

6. Topic spread: no two blocks from the same topic unless the pool leaves
   no alternative. Report when it was forced.

7. Internal choice: where a section has allow_choice, draw two
   alternatives matched on marks and chapter, marked
   is_choice_alternative.

8. Failure is a structured result, never a partial paper and never an
   exception:
   { ok: false, reason,
     shortfall: [{chapter, strand, marks, needed, available}],
     suggestions: [{relax: 'repeat_guard'|'difficulty'|'topic_spread'|'strand_balance',
                    would_yield: n}] }
   The generator never silently produces a worse paper to avoid saying no.

9. Determinism: same inputs plus same seed, same paper. Persist the seed.

10. swapBlock(paper_block_id): a replacement of identical total marks,
    same chapter, same difficulty band, same stimulus-ness, not in this
    paper, not in the last N papers. Locked blocks are never touched.

11. Writes: papers, paper_sections, paper_blocks, paper_questions, and a
    question_exposure row per student in the batch per question, all
    carrying institute_id.

Tests against a seeded synthetic bank spanning at least four
class-subjects and three institutes, including one with passages and one
with strands:
- 50 generations per pattern, asserted on marks total, difficulty
  tolerance, repeat guard, topic spread, strand balance, block integrity
- no generated paper ever contains a question owned by a third institute
- a paper mixing shared and private questions generates correctly
- an institute with zero private questions generates from the shared bank
  alone
- block integrity: no paper contains a question whose stimulus is absent
- a deliberately thin pool failing with a correct shortfall report
- swap preserving every invariant
- determinism: same seed, identical output, twice

Show me the test output before writing any UI.
```

---

### C6 · Multi-set shuffle engine [4 h]

**Goal:** One paper becomes N printable orderings a neighbour cannot copy from, without breaking marking, blocks, or mistake logging.

**Depends on:** C5. Unchanged from v2.2 apart from carrying `institute_id` onto the rows it writes.

**Acceptance**
```bash
npm test -- sets
```

**Prompt**

```text
Build the multi-set shuffle engine. Read section 3 of docs/BUILD-PLAN.md in
full first. This exists so that students sitting adjacent cannot copy.

buildSets(paper_id, set_count, batch_size) writes paper_sets,
paper_set_items and paper_set_options, each carrying the paper's
institute_id.

Hard constraints, enforced in code and asserted in tests:

1. Every set contains exactly the same questions. Only order differs.

2. THE SHUFFLE UNIT IS A BLOCK, NOT A QUESTION. A stimulus and its
   questions move together as one unit, in their original internal order.
   Multi-part questions stay ordered under their parent. A naive
   per-question shuffle passes every test on a Biology paper and destroys
   an English comprehension paper, so test this explicitly with a passage.

3. Permutations are generated per section. A block never moves between
   sections.

4. Every display_position carries the same marks value in every set.
   Where a section mixes mark values, permute within mark-value groups.
   This is the constraint most likely to be quietly violated and it is
   what keeps the teacher's marking column identical across sets.

5. Blocks with position_locked hold their position in every set.

6. Option order: shuffle only where questions.options_shufflable is true.
   Where false, write nothing and print canonical order.

7. Store permutations as rows, never a seed regenerated on demand.
   Reprinting set B in six months must be byte identical.

8. Maximise positional dispersion. Return the measured pairwise overlap.

9. Sections too short to permute return a warning, not a silent pass:
   { section: 'E', blocks: 2, sets: 3,
     note: 'two sets must share ordering in this section' }

10. copiesBreakdown(batch_size, set_count): even split, remainder to the
    earlier sets. 40 across 3 gives 14, 13, 13.

Property tests with fast-check, against paper shapes including a passage
block, a multi-part question, a position-locked map question and a choice
pair:
- the question multiset is invariant across sets
- marks-per-position is invariant across sets
- no block is ever split across positions
- no cross-section movement
- position_locked blocks never move
- pairwise positional overlap <= 15% wherever section length allows
- rerunning is idempotent and identical
- no paper_set_options row for a question with options_shufflable = false

Then a database-level test proving the C1 marks-per-position trigger
actually rejects a bad insert. I want to know the trigger works, not that
the application layer happens to be careful.
```

---

### C7 · Print output [6 h]

**Goal:** What comes out of an institute's printer is a paper that institute's teacher would have set, in any subject or script.

**Depends on:** C6, H9

**Prompt**

```text
Build the print output. Read section 3.3 of docs/BUILD-PLAN.md.

Per generated paper:

1. One question paper per set. Header: THE INSTITUTE'S OWN NAME AND LOGO,
   class, subject, test title, total marks, duration, and the SET LETTER
   at 24pt minimum. Footer on every page: set letter, page n of m.
   The institute name comes from the institutes row, never a constant.
   Printing institute A's name on institute B's paper is the kind of bug
   that ends a customer relationship in one afternoon, so test it.

2. One answer key per set, numbered in that set's display order. Where
   option order was shuffled, the key shows the shuffled letter. Getting
   this wrong hands the teacher a key that marks correct answers wrong.

3. One master mapping sheet: canonical number, position in each set, the
   answer, the marks, with a header line: "Hand out in a repeating cycle
   A, B, C along each row."

4. A copies summary for the batch size.

Layout requirements:
- CSS print stylesheet, A4, 15mm margins, no browser headers.
- page-break-inside: avoid on every block. A stimulus must never be
  separated from its questions across a page break.
- A passage that legitimately exceeds a page repeats with a "contd."
  marker and its questions follow on the next page, never before it.
- KaTeX server-rendered, so print does not depend on fonts loading.
- Noto Sans Devanagari embedded and self-hosted. Test matra positioning
  specifically; it breaks in ways only paper reveals.
- Maps and diagrams at print resolution from the original.
- Internal choice renders as "OR" between alternatives, in the pattern's
  language.
- Section headers repeat with "continued" when a section spans pages.
- An institute logo slot that degrades cleanly when no logo is set.

5. A single "Print everything" action producing one PDF: all set papers,
   then all keys, then the mapping sheet.

Preview route at /teacher/papers/[id]/print rendering exactly what prints,
with a set selector. I am going to print this on a real printer including a
Hindi paper and a comprehension paper, and I expect to find several things
wrong. Keep layout in one stylesheet, not scattered inline styles.
```

---

### C8 · Teacher screens [8 h]

**Goal:** The screen in `teacher-app-demo.html`, working, across every class-subject active for that teacher's institute.

**Depends on:** C5, C6, C7. **Was 7 h**; the extra hour is institute context and the private-question surface.

**Prompt**

```text
Build the teacher screens. teacher-app-demo.html is the visual and
structural reference. Match its layout, density and left rail. Replace
hardcoded data with real queries. Do not redesign it.

1. /teacher/generate
   Filter panel: class and subject from my_active_class_subjects,
   restricted to this teacher's teacher_subjects, pattern selector
   (platform patterns plus this institute's own), chapter checkboxes each
   with a live count of approved questions, strand weights where
   applicable, difficulty mix, rules toggles.

   The chapter counts must show the pool this teacher will actually draw
   from: shared plus this institute's private, minus flagged. A count
   that includes questions the generator cannot use will be reported as a
   bug within a week.

   Add a "Printed sets" control, default 1, options 1 to 4. Above 1, show
   the copies breakdown and any short-section warnings from buildSets
   BEFORE printing rather than after.

   Preview column: the paper as blocks. A stimulus renders once with its
   questions nested. Lock and swap operate on blocks. Locked blocks
   survive a regenerate. Mark private questions with a small indicator so
   the teacher knows which came from their own institute's material.

   Failure renders the structured shortfall: which chapter or strand ran
   short, by how much, and each relaxation option with what it would
   yield. The teacher chooses. Never auto-relax.

2. /teacher/papers
   History filtered by class-subject, showing date, marks, chapters, set
   count. Reprint any past paper with identical output including identical
   sets.

3. /teacher/batches
   From C2, wired to real data, plus per-batch paper history.

4. Flagging: one click on any question, writing question_flags with this
   institute_id. Per section 5.3, a flag suppresses that question for
   THIS INSTITUTE ONLY and does not change the shared question's status.
   Tell the teacher exactly that in one line, because "I flagged it and
   it is still in the bank" is otherwise a support ticket.

Performance: chapter coverage counts must be one aggregate query per
class-subject, cached for the session, not a query per chapter. With 26
class-subjects and a two-owner pool the naive version will be visibly slow.

Server components reading through the typed client, except the interactive
preview. The institute is resolved server-side; no component takes it as a
prop from the client.
```

---

### C9 · Student screens [8 h]

**Goal:** The screen in `student-app-demo.html`, working, installable, multi-subject, including the set picker.

**Depends on:** C6, C8. **Was 7 h**; the extra hour is institute branding and the multi-institute edge case.

**Acceptance.** Install on a real mid-range Android on 4G. Log a test in under 60 seconds. Deliberately pick the wrong set and confirm the confirmation screen catches it.

**Prompt**

```text
Build the student screens. student-app-demo.html is the visual reference,
including phone layout, tap targets and the bottom tab bar. Match it.

1. Institute and subject context. The app bar shows the institute name.
   A student may be in several batches, one per subject; the app bar
   carries a subject switcher. Default to the subject with the most recent
   unlogged paper. Everything below is scoped to the selected subject
   within the current institute.

2. /app test list: papers for the student's batch in the selected subject,
   newest first, each showing whether it has been logged. Show unlogged
   papers across all subjects in a single "needs logging" strip at the
   top, because that is the habit we are trying to build.

3. Set selection, per section 3.4. When a paper has more than one set:
   - "Which set did you write?" with a button per set letter. No default,
     cannot be skipped or dismissed.
   - Then: the first twelve words of question 1 for the chosen set, and
     "Is this question 1 on your sheet?" Yes proceeds, No returns.
   Single-set papers skip both. Store on attempts.paper_set_id.

4. Mistake logging. Questions render in the chosen set's display order.
   Stimulus blocks show the passage heading once with its questions
   beneath. One tap per wrong question. A running count. No score, no
   percentage, ever.

   Critical: attempt_items stores question_id, resolved from the tapped
   display_position through paper_set_items. Never store the position as
   the identity. Record display_position alongside for auditing.

5. Practice set. Built only from sections where the pattern says
   practice_eligible. For ineligible sections, show a clear line: "No
   practice set for the writing section" rather than serving irrelevant
   questions. Solutions gated by can_read_solution. Mark each item done.

6. Weak spots, per subject, per topic, as in the demo, including the
   "wrong in 3 of the last 3 tests" note. Topics from ineligible sections
   are excluded and the screen says which sections are not tracked.

7. Past tests, read-only, per subject.

8. PWA: manifest, icons, service worker caching the app shell.
   Installable from Chrome on Android, prompt after the second visit.
   Test list and loaded practice sets readable offline. Logging requires
   connectivity and must say so clearly rather than failing into an
   invisible queue.

   The cached shell must not leak institute data between accounts on a
   shared device. Key the cache by user, and clear it on sign-out.

Performance budget: test list interactive in under 2.5 seconds on a
mid-range Android over 4G. Measure it. Devanagari font loading must not
block first paint.
```

---

### C10 · Practice matcher and analytics [5 h]

**Goal:** Taps produce practice worth doing where practice makes sense, and a weak-spot map that is true.

**Depends on:** C9

**Prompt**

```text
Build the practice matcher and weak-spot analytics.

buildPracticeSet(attempt_id):

1. Read attempt_items where is_correct is false, EXCLUDING any question
   in a pattern section where practice_eligible is false. Pull topic,
   chapter, strand, difficulty, marks.

2. Candidate pool: same class_subject, owner in (platform, this
   institute), same topic, difficulty within one band either side, status
   approved, not flagged by this institute, not in question_exposure for
   this student, and NOT a member of a stimulus block. A comprehension
   question without its passage is meaningless. If a topic has only
   stimulus-bound questions available, serve the whole block, counted as
   one item.

3. Rank: exact topic above sibling topics in the same chapter, above
   sibling topics in the same strand. Questions with a written solution
   above those without.

4. Cap: 3 per wrong question, 15 per set.

5. Empty pool: widen topic to chapter, and write a coverage_gaps row with
   institute, class_subject, topic, difficulty and timestamp. The student
   never sees an empty screen. If the chapter is also empty, serve the 3
   nearest by difficulty with a note and log a severe gap.

6. If every wrong question came from an ineligible section, produce no
   practice set and return a reason the UI can display. Do not produce an
   empty set object.

No spaced repetition. Phase 3, explicitly out of scope.

Writes: practice_sets, practice_set_items, question_exposure, all
carrying institute_id.

Analytics as views or typed functions, all tenant-scoped:
- per-student per-topic accuracy, per class-subject, eligible sections only
- consecutive-wrong streak per topic
- coverage by class_subject, chapter, topic and difficulty, for the
  teacher's counts and for platform activation readiness. The platform
  view aggregates across institutes; the teacher view never does.

Also build the teacher set override from section 3.4: on
/teacher/papers/[id], list students who logged with their chosen set and
an action to correct it. Correcting must, in one transaction: remap every
attempt_item to the correct question_id via the correct set, delete the
practice set built from the wrong mapping, rebuild it, and leave
question_exposure consistent. Test this. A half-applied remap is worse
than no override.
```

---

### C11 · Activation, per class-subject [~15 h each, then ~1 h per additional institute]

**Goal:** One class-subject moves from `planned` to `ready` at the platform level, and from `planned` to `active` for an institute.

**Not a coding checkpoint.** This is the repeating unit of ongoing work and where the real cost lives.

**The v3.0 improvement, and it is the main commercial argument for the whole rewrite.** In v2.2, activating Class 10 Science cost 15 hours, and doing it for a second institute would have cost 15 hours again. Under the shared bank, the second institute costs about an hour: check the gate, activate, done. The 15 hours is paid once per class-subject across the entire platform, not once per class-subject per customer.

**First activation of a class-subject (platform level)**

| Step | Owner | Time |
|---|---|---|
| Set `bank_status` to `seeding` | Platform | 1 min |
| H6b: agree topic granularity with a teacher who owns the subject | Both | 2 h |
| H7: calibrate easy / medium / hard | Both | 1 h |
| Collect sources: board papers, NCERT, exemplar, institute sets | Teacher | — |
| Run C3 ingestion sessions, 60-100 pages each, skim each summary | Platform | 2 h |
| H8: review the first batch together with the teacher | Both | 1 h |
| Skim and approve the remaining batches (C4) | Platform | ~12 h |
| Coverage check, fill thin chapters | Platform | 1 h |
| Generate 5 papers across different chapter combinations, teacher reads all 5 | Both | 1 h |
| Set `bank_status` to `ready` | Platform | 1 min |

**Per additional institute (about an hour)**

| Step | Owner | Time |
|---|---|---|
| Confirm the gate still passes | Platform | 5 min |
| Generate 3 papers, that institute's teacher reads all 3 | Both | 45 min |
| Set `institute_class_subjects.status` to `active` | Platform | 1 min |

The three-paper read is not a formality. A bank calibrated with institute A's teacher may be pitched wrong for institute B's students, and finding that out from a teacher before the first test is much cheaper than after.

**Activation gate**

```sql
select c.name as chapter,
       count(*) filter (where q.difficulty='easy')   as easy,
       count(*) filter (where q.difficulty='medium') as med,
       count(*) filter (where q.difficulty='hard')   as hard,
       count(*) as total
from questions q
join chapters c on c.id = q.chapter_id
where q.status = 'approved'
  and q.class_subject_id = $1
  and q.owner_institute_id in (platform_institute_id(), $2)
group by c.name order by total;
```

Do not flip to `active` unless: no chapter under 60 approved questions, no topic under 8, every pattern section type has at least 3× its required count available, and a teacher confirms all five (or three) generated papers are ones they would have set. A class-subject that goes active thin produces repetitive papers within two tests and loses the teacher permanently — and now loses them at every institute it was activated for.

**Order of activation.** Start with one class-subject where the practice loop is strongest and the source material is best. Class 10 Science or Class 12 Biology. Prove the loop there before spending 15 hours on Class 9 Hindi.

**Realistic capacity.** One first-activation is about 15 hours. Two per month is sustainable alongside anything else. All 26 is 390 hours and is still not a plan — but under the shared bank it is 390 hours for the whole platform rather than per customer, which is the difference between an impossible number and a slow one.

---

### C12 · Hardening [10 h]

**Goal:** It survives a term without you watching it, across several tenants.

**Was 7 h.** The extra three are the cross-tenant isolation suite, per-tenant health, and the data export.

**Prompt**

```text
Harden this for a live multi-tenant pilot. No new features.

1. Nightly backup: GitHub Actions running pg_dump -Fc against production,
   uploading to Cloudflare R2, 30 day retention. It must fail loudly, by
   email, if it fails. A silently broken backup is the worst outcome, and
   it is now other people's data.

2. scripts/restore.sh taking a dump and a target connection string.
   Document the exact steps in docs/RUNBOOK.md. I will run this against a
   scratch project and I expect it to work first time.

3. Keep-alive: a daily scheduled trivial query so the free tier does not
   pause after 7 days. Term breaks are exactly when this matters.

4. /platform/health: database size against 500 MB, storage against 1 GB,
   egress against 5 GB, function invocations against 1M, last successful
   backup timestamp, a per-institute breakdown of rows and storage, and a
   per-class-subject coverage table showing bank_status and distance from
   the activation gate. Email alert at 70% of any limit, and a separate
   alert if any single institute exceeds 40% of total usage.

5. Sentry free tier, in the app, with institute_id as a tag on every
   event so a tenant-specific bug is visible as one.

6. Rate limiting on the generate endpoint, per institute as well as per
   user, so one tenant cannot exhaust a shared quota.

7. THE CROSS-TENANT ISOLATION SUITE, as a standalone test run in CI and
   before every production deploy. Enumerate every table from
   information_schema. For each, seed rows in two institutes and assert,
   as each of student / teacher / institute_admin in institute A, that
   zero rows of institute B are visible on select, and that update and
   delete against institute B's rows affect zero rows. A new table added
   without tenancy must fail here. This is the single most important
   test in the codebase; do not let it be skippable.

8. /institute/export: an institute admin downloads their full data as
   JSON (members, batches, enrolments, papers, attempts, practice sets,
   their own private questions) plus their papers as PDFs. Rate limited,
   audited. Their private questions are included; the shared bank is not.

9. docs/RUNBOOK.md: restoring a backup, rotating a leaked key, the free to
   Pro upgrade path with exact steps and expected downtime, pulling a bad
   question from circulation, correcting a student's wrong set,
   onboarding an institute (§4.4), offboarding one, activating a
   class-subject, and what to do if a tenant reports seeing another
   tenant's data (treat as a sev-1: suspend, verify, disclose).

10. A seeded staging environment: same schema, synthetic questions across
    several class-subjects and THREE institutes, so future work never
    touches real data and tenancy bugs surface there first.

Load test: 40 concurrent students across two institutes loading the test
list and logging an attempt. Report p95 latency. I want the real number,
not the modelled one from the pitch deck.
```

---

## 8. Schedule

| Checkpoint | v2.2 | v3.0 | Elapsed |
|---|---|---|---|
| C0 Infrastructure and DB control | 3 | 3 | 2 days |
| C1 Schema, tenancy, RLS, taxonomy | 6 | **9** | 5 days |
| C2 Auth, membership, batches | 4 | **7** | 4 days |
| C2b Platform console | — | **6** | 4 days |
| C3 Ingestion prep | 2 | 2 | 1 day |
| C4 Review flow prep | 0 | 0 | — |
| C5 Paper generator | 6 | 6 | 4 days |
| C6 Multi-set shuffle | 4 | 4 | 3 days |
| C7 Print output | 6 | 6 | 4 days |
| C8 Teacher screens | 7 | **8** | 5 days |
| C9 Student screens | 7 | **8** | 5 days |
| C10 Matching and analytics | 5 | 5 | 3 days |
| C12 Hardening | 7 | **10** | 6 days |
| **Software total** | 57 | **74 h** | **~7 weeks** |
| C11 First activation of a class-subject | ~15 h | ~15 h | ~1 week |
| **First usable class-subject** | ~72 h | **~89 h** | **~8 weeks** |
| Each additional class-subject | ~15 h | ~15 h | |
| **Each additional institute on an existing class-subject** | ~15 h | **~1 h** | |

That last row is the whole point. v2.2's cost model made a second customer as expensive as the first. v3.0's makes them nearly free in content terms, which is the only version of this that becomes a business.

**Update the deck before showing it again.** The deck says 61 hours and 5 weeks. The honest number is now about 89 hours and 8 weeks to a first activated class-subject at one institute. Sir was told 5 weeks under a plan where he owned the infrastructure. He is now being told 8 weeks under a plan where he does not. Both of those are reasonable changes and neither survives being discovered rather than explained. One conversation, before the account migration.

---

## 9. Rollout gates

| Phase | What happens | Pass condition |
|---|---|---|
| 0 | Build the software | All checkpoints green, cross-tenant suite passing |
| 0a | Two synthetic institutes coexist | The C12 isolation suite passes on every table, and you have read it |
| 0b | Activate the first class-subject for institute one | The C11 gate is met, and 5 generated papers are ones the teacher would have set |
| 1 | The teacher uses it, students do not | He stops building papers by hand for that subject |
| 1b | First multi-set paper in a real test | Marking three sets took no longer than marking one |
| 2 | One batch logs mistakes | Over 60% of the batch logs within two days of getting the paper back |
| 2b | Activate a second class-subject | Second activation takes under 15 hours |
| 3 | **Onboard institute two** | Onboarding takes under 15 minutes, first activation for them takes under 2 hours, and no cross-tenant defect appears in the first month |
| 4 | Widen | An institute asks for the next subject before it is offered |

Gate 3 is new and it is the one that decides whether this is a product. If onboarding institute two costs a day of manual work and produces one cross-tenant bug, the multi-tenant rewrite has not paid for itself and you should know that at institute two rather than institute six.

---

## 10. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Cross-tenant data leak** | **Possible** | **Severe** | Tenant key on every table, no nullable "global", no blanket platform policy, the C12 enumerated isolation suite, three-institute dev and staging data, tenancy lint in CI |
| **Copyright on a bank distributed to multiple paying institutes** | **Likely** | **Severe** | Get a real answer before customer two. Shared bank restricted to NCERT, exemplar and public board material; uncertain provenance stays in the originating institute's private layer |
| Activation cost underestimated, bank stays thin across many subjects | Likely | High | The activation gate. Never flip to active thin. One or two first-activations per month |
| Sir discovers the ownership change or the shared-bank arrangement after the fact | **Likely if not addressed** | **High** | §4.1. Have the conversation before the account migration, not after |
| Empty subject options make the app look broken | Likely | High | `my_active_class_subjects`, enforced in one place, plus the activation request queue so "not yet" is visible |
| Student selects the wrong set, poisoning their weak-spot data silently | Likely | High | Confirmation screen, teacher override with transactional remap |
| Practice loop pitched for English writing, fails, damages credibility | Possible | High | `practice_eligible` on pattern sections, and say so out loud in the pitch |
| Stimulus block split across sets or pages | Possible | High | Blocks as the unit everywhere, property tests, print rules |
| Devanagari extraction quality lower than expected | Likely | Medium | Measure the quarantine rate in C3 before committing to a Hindi activation. Activate Hindi last |
| Wrong answer key printed against the wrong set | Possible | High | Per-set key from the same rows, explicit test on shuffled option letters |
| **Institute A's name printed on institute B's paper** | Possible | High | Institute name from the row, never a constant. Explicit print test with two institutes |
| Marking three sets takes 3× as long, teacher stops using sets | Possible | Medium | Master mapping sheet, mark-per-position invariance |
| Students do not log mistakes | Likely | High | Not a software fix. The teacher saying "open it now" in class, for a month |
| **Support load scales with customers and lands on one person** | **Likely** | **High** | C2b's support screens instead of manual SQL. An agreed maintenance window per institute, in writing, before signing them |
| Platform account compromised or its 2FA lost | Possible | Severe | It is infra root for every tenant. Password manager, 2FA everywhere, recovery codes reachable by a second trusted person |
| Institute admin granted platform rights "temporarily" | Possible | Severe | Impossible through `set_member_role` by construction, asserted in tests, `role_audit` reviewed at every activation |
| An agentic session writes across tenants | Possible | Severe | Manual tool approval stays on permanently, MCP never writes to prod, ingestion runs against dev |

The top two rows are what changed in v3.0 and they are now the two biggest risks in the project. Everything about how you sequence this should follow from that.

---

## 11. Session ritual

Start every Claude Code session:

```text
Read docs/BUILD-PLAN.md and CLAUDE.md.
We are on checkpoint C<n>. Everything through C<n-1> is committed and tagged.
Do not modify anything outside the scope of C<n>.
Before writing code, give me your plan in five bullets and stop.
```

End every session:

```text
Run the acceptance commands for C<n> and paste the raw output.
Run the tenancy lint and the cross-tenant tests, and paste that output too.
List every file you created or modified.
List anything you changed outside the checkpoint scope, and why.
```

Then run the acceptance commands yourself, and tag.
