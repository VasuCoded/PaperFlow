# Ingestion standing brief (BUILD-PLAN C3)

Paste this at the **start of every ingestion session**. Do not assume a new
session remembers the last one. Ingestion runs against **dev only**, with manual
tool approval on, per CLAUDE.md.

Before trusting any session with ingestion, confirm once by hand:

- The C1 status guard rejects an `approved` insert from a non-review context
  (inserts are forced to `staging`).
- An insert with no `owner_institute_id` is rejected outright (NOT NULL), not
  defaulted to anything.

---

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

---

## Running it well

- 60–100 pages a session keeps the session coherent and the summary meaningful.
- Hindi sources: expect a higher "unsure" rate; budget ~60s/question, not 45.
  Devanagari duplicate detection relies on `body_normalised` (NFC) and the
  `simple` tsv config — both are handled by the questions trigger automatically.
- Treat the first batch of any class-subject as a **calibration run**.

## Acceptance per batch

```sql
select owner_institute_id, status, count(*) from questions
where class_subject_id = '<the one just ingested>'
group by 1, 2;
-- everything is 'staging', and the owner is the institute you intended.
```

## Review (C4)

Approve staged rows at `/platform/bank` (once C2b is built) or via a session:

```text
Show me everything you just inserted with status='staging' from this
session, grouped by chapter, with the body, answer and any note you left.
```

Then approve the batch minus anything flagged. Nothing reaches `approved`
except through a step a human performed, looking at what was extracted.
