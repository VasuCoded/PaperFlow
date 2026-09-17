import { describe, it, expect, beforeAll, afterEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { actAs, actAsOwner, bootstrapDb } from "../../scripts/schema-harness";

/** Migration 0017: generation rate limits, per person and per institute. */
const INST = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const TEACHER = "a2a2a2a2-0000-0000-0000-000000000001";
const TEACHER2 = "a2a2a2a2-0000-0000-0000-000000000002";
const STUDENT = "a3a3a3a3-0000-0000-0000-000000000001";
const OTHER_TEACHER = "b2b2b2b2-0000-0000-0000-000000000001";

let db: PGlite;

async function n(sql: string): Promise<number> {
  return Number((await db.query<{ n: number }>(sql)).rows[0]?.n ?? 0);
}

/** Backfill events as the table owner, `minutesAgo` in the past. */
async function backfill(inst: string, user: string, kind: "preview" | "save", count: number, minutesAgo = 1) {
  await actAsOwner(db);
  await db.query(
    `insert into generation_events (institute_id, user_id, kind, at)
     select '${inst}', '${user}', '${kind}', now() - interval '${minutesAgo} minutes' from generate_series(1, ${count})`,
  );
}

beforeAll(async () => {
  const boot = await bootstrapDb({ quiet: true });
  if (boot.failure) throw new Error(`${boot.failure.file}: ${boot.failure.error}`);
  db = boot.db;
  await db.exec(`
    insert into auth.users (id, email) values
      ('${TEACHER}', 't1@a.test'), ('${TEACHER2}', 't2@a.test'), ('${STUDENT}', 's@a.test'), ('${OTHER_TEACHER}', 't@b.test');
    insert into institutes (id, name, slug, kind, status) values
      ('${INST}', 'A', 'a', 'institute', 'active'), ('${OTHER}', 'B', 'b', 'institute', 'active');
    insert into institute_members (institute_id, user_id, role) values
      ('${INST}', '${TEACHER}', 'teacher'), ('${INST}', '${TEACHER2}', 'teacher'),
      ('${INST}', '${STUDENT}', 'student'), ('${OTHER}', '${OTHER_TEACHER}', 'teacher');
  `);
});

afterEach(async () => {
  await actAsOwner(db);
  await db.query("delete from generation_events");
});

describe("note_generation", () => {
  it("records a preview for a teacher", async () => {
    await actAs(db, TEACHER);
    await db.query(`select note_generation('${INST}', 'preview')`);
    await actAsOwner(db);
    expect(await n(`select count(*)::int as n from generation_events where user_id = '${TEACHER}' and kind = 'preview'`)).toBe(1);
  });

  it("refuses students, and teachers of another institute", async () => {
    await actAs(db, STUDENT);
    await expect(db.query(`select note_generation('${INST}', 'preview')`)).rejects.toThrow(/not authorised/);
    await actAs(db, OTHER_TEACHER);
    await expect(db.query(`select note_generation('${INST}', 'preview')`)).rejects.toThrow(/not authorised/);
  });

  it("stops one person at 120 previews in ten minutes, without affecting a colleague", async () => {
    await backfill(INST, TEACHER, "preview", 120);
    await actAs(db, TEACHER);
    await expect(db.query(`select note_generation('${INST}', 'preview')`)).rejects.toThrow(/rate limit: you have made 120 preview/);
    await actAs(db, TEACHER2);
    await db.query(`select note_generation('${INST}', 'preview')`);
  });

  it("counts previews and saves separately", async () => {
    await backfill(INST, TEACHER, "preview", 120);
    await actAs(db, TEACHER);
    await db.query(`select note_generation('${INST}', 'save')`);
    await backfill(INST, TEACHER, "save", 19);
    await actAs(db, TEACHER);
    await expect(db.query(`select note_generation('${INST}', 'save')`)).rejects.toThrow(/rate limit: you have made 20 save/);
  });

  it("forgets requests older than ten minutes", async () => {
    await backfill(INST, TEACHER, "preview", 120, 11);
    await actAs(db, TEACHER);
    await db.query(`select note_generation('${INST}', 'preview')`);
  });

  it("stops an institute at 600 previews, and leaves other institutes alone", async () => {
    await backfill(INST, TEACHER2, "preview", 600);
    await actAs(db, TEACHER);
    await expect(db.query(`select note_generation('${INST}', 'preview')`)).rejects.toThrow(/rate limit: your institute has made 600/);
    await actAs(db, OTHER_TEACHER);
    await db.query(`select note_generation('${OTHER}', 'preview')`);
  });

  it("prunes events older than a day", async () => {
    await backfill(INST, TEACHER, "preview", 5, 60 * 25);
    await actAs(db, TEACHER);
    await db.query(`select note_generation('${INST}', 'preview')`);
    await actAsOwner(db);
    expect(await n(`select count(*)::int as n from generation_events where institute_id = '${INST}'`)).toBe(1);
  });

  it("cannot be written directly, and a teacher cannot read the log", async () => {
    await actAs(db, TEACHER);
    await expect(
      db.query(`insert into generation_events (institute_id, user_id, kind) values ('${INST}', '${TEACHER}', 'preview')`),
    ).rejects.toThrow(/row-level security/);
    await backfill(INST, TEACHER, "preview", 3);
    await actAs(db, TEACHER);
    expect(await n(`select count(*)::int as n from generation_events`)).toBe(0);
  });
});
