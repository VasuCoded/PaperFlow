import { describe, it, expect, beforeAll, afterEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { actAs, actAsOwner, bootstrapDb } from "../../scripts/schema-harness";

/**
 * Migration 0019: username accounts and the access-request queue. An account
 * grants nothing; a request names an institute (never a role); the approver
 * chooses the role; only the platform makes institute admins.
 */
const PLATFORM = "11111111-1111-1111-1111-111111111111";
const INST = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const SUSPENDED = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const OWNER = "0f0f0f0f-0000-0000-0000-000000000001";
const ADMIN = "a1a1a1a1-0000-0000-0000-000000000001";
const OTHER_ADMIN = "b1b1b1b1-0000-0000-0000-000000000001";
const TEACHER = "a2a2a2a2-0000-0000-0000-000000000001";
const NEWBIE = "e0e0e0e0-0000-0000-0000-000000000001";
const NEWBIE2 = "e0e0e0e0-0000-0000-0000-000000000002";
const NEWBIE3 = "e0e0e0e0-0000-0000-0000-000000000003";
const UNCONFIRMED = "e0e0e0e0-0000-0000-0000-00000000000f";

let db: PGlite;

async function one<T>(sql: string): Promise<T> {
  return (await db.query<T>(sql)).rows[0] as T;
}
async function n(sql: string): Promise<number> {
  return Number((await db.query<{ n: number }>(sql)).rows[0]?.n ?? 0);
}

beforeAll(async () => {
  const boot = await bootstrapDb({ quiet: true });
  if (boot.failure) throw new Error(`${boot.failure.file}: ${boot.failure.error}`);
  db = boot.db;
  await db.exec(`
    insert into auth.users (id, email, raw_user_meta_data) values
      ('${OWNER}', 'owner@platform.test', '{}'),
      ('${ADMIN}', 'admin@a.test', '{}'),
      ('${OTHER_ADMIN}', 'admin@b.test', '{}'),
      ('${TEACHER}', 'teacher@a.test', '{}'),
      ('${NEWBIE}', 'ravi@users.paperflow.invalid', '{"username":"Ravi.Kumar","full_name":"Ravi Kumar"}'),
      ('${NEWBIE2}', 'meera@users.paperflow.invalid', '{"username":"meera","full_name":"Meera Iyer"}'),
      ('${NEWBIE3}', 'dev@users.paperflow.invalid', '{"username":"dev_09","full_name":"Dev"}');
    insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
      ('${UNCONFIRMED}', 'squatter@a.test', null, '{}');
    insert into institutes (id, name, slug, kind, status) values
      ('${INST}', 'Sunrise', 'sunrise', 'institute', 'active'),
      ('${OTHER}', 'Other', 'other', 'institute', 'active'),
      ('${SUSPENDED}', 'Closed', 'closed', 'institute', 'suspended');
    insert into institute_members (institute_id, user_id, role) values
      ('${PLATFORM}', '${OWNER}', 'owner'),
      ('${INST}', '${ADMIN}', 'institute_admin'),
      ('${OTHER}', '${OTHER_ADMIN}', 'institute_admin'),
      ('${INST}', '${TEACHER}', 'teacher');
    insert into institute_invites (institute_id, email, role) values ('${INST}', 'squatter@a.test', 'teacher');
  `);
});

afterEach(async () => {
  await actAsOwner(db);
});

describe("usernames", () => {
  it("are taken from sign-up metadata, lower-cased", async () => {
    expect(await one<{ username: string; full_name: string }>(`select username::text, full_name from profiles where id = '${NEWBIE}'`)).toEqual({
      username: "ravi.kumar",
      full_name: "Ravi Kumar",
    });
  });

  it("are unique regardless of case", async () => {
    await expect(
      db.query(`insert into auth.users (id, email, raw_user_meta_data) values ('e0e0e0e0-0000-0000-0000-000000000009', 'x@users.paperflow.invalid', '{"username":"MEERA"}')`),
    ).rejects.toThrow(/duplicate|unique/);
  });

  it("must look like a username", async () => {
    await expect(db.query(`update profiles set username = 'a b' where id = '${NEWBIE3}'`)).rejects.toThrow(/profiles_username_format/);
    await expect(db.query(`update profiles set username = '.dot' where id = '${NEWBIE3}'`)).rejects.toThrow(/profiles_username_format/);
  });
});

describe("a new account", () => {
  it("belongs to nothing and can list only active institutes it is not in", async () => {
    await actAs(db, NEWBIE);
    expect(await n(`select count(*)::int as n from institute_members`)).toBe(0);
    const names = (await db.query<{ name: string }>(`select name from requestable_institutes()`)).rows.map((r) => r.name);
    expect(names).toEqual(["Other", "Sunrise"]);
    await actAs(db, TEACHER);
    expect((await db.query<{ name: string }>(`select name from requestable_institutes()`)).rows.map((r) => r.name)).toEqual(["Other"]);
  });

  it("cannot accept an invitation for an address it has not confirmed", async () => {
    await actAs(db, UNCONFIRMED);
    const inv = await n(`select count(*)::int as n from my_pending_invites()`);
    expect(inv).toBeGreaterThanOrEqual(0);
    await actAsOwner(db);
    const id = (await one<{ id: string }>(`select id from institute_invites where email = 'squatter@a.test'`)).id;
    await actAs(db, UNCONFIRMED);
    await expect(db.query(`select accept_invite('${id}')`)).rejects.toThrow(/not authenticated/);
  });
});

describe("requesting access", () => {
  it("raises a pending request with a note, once per institute", async () => {
    await actAs(db, NEWBIE);
    await db.query(`select request_access('${INST}', 'I teach physics to class 10')`);
    await expect(db.query(`select request_access('${INST}', 'again')`)).rejects.toThrow(/already asked/);
    const mine = (await db.query<{ institute_name: string; status: string }>(`select institute_name, status from my_access_requests()`)).rows;
    expect(mine).toEqual([{ institute_name: "Sunrise", status: "pending" }]);
  });

  it("refuses suspended institutes, and institutes you already belong to", async () => {
    await actAs(db, NEWBIE2);
    await expect(db.query(`select request_access('${SUSPENDED}', null)`)).rejects.toThrow(/institute not found/);
    await actAs(db, TEACHER);
    await expect(db.query(`select request_access('${INST}', null)`)).rejects.toThrow(/already a member/);
  });

  it("cannot be inserted or edited directly", async () => {
    await actAs(db, NEWBIE2);
    await expect(db.query(`insert into access_requests (institute_id, user_id) values ('${INST}', '${NEWBIE2}')`)).rejects.toThrow(/row-level security/);
    await actAs(db, NEWBIE);
    await db.query(`update access_requests set status = 'approved', granted_role = 'institute_admin'`);
    await actAsOwner(db);
    expect(await n(`select count(*)::int as n from access_requests where status = 'approved'`)).toBe(0);
  });

  it("is visible to the institute's admins and nobody else's", async () => {
    await actAs(db, ADMIN);
    const rows = (await db.query<{ username: string; note: string }>(`select username, note from institute_access_requests('${INST}')`)).rows;
    expect(rows).toEqual([{ username: "ravi.kumar", note: "I teach physics to class 10" }]);
    await actAs(db, OTHER_ADMIN);
    await expect(db.query(`select * from institute_access_requests('${INST}')`)).rejects.toThrow(/institute admin only/);
    expect(await n(`select count(*)::int as n from access_requests`)).toBe(0);
    await actAs(db, TEACHER);
    await expect(db.query(`select * from institute_access_requests('${INST}')`)).rejects.toThrow(/institute admin only/);
  });
});

describe("deciding", () => {
  it("an institute admin approves as teacher: membership + audit row, and the requester sees the outcome", async () => {
    await actAs(db, ADMIN);
    const id = (await one<{ id: string }>(`select id from institute_access_requests('${INST}')`)).id;
    await db.query(`select decide_access_request('${id}', true, 'teacher')`);
    await actAsOwner(db);
    expect(await n(`select count(*)::int as n from institute_members where user_id = '${NEWBIE}' and institute_id = '${INST}' and role = 'teacher'`)).toBe(1);
    expect(await n(`select count(*)::int as n from role_audit where target = '${NEWBIE}' and new_role = 'teacher' and actor = '${ADMIN}'`)).toBe(1);
    await actAs(db, NEWBIE);
    expect(await one<{ status: string; granted_role: string }>(`select status, granted_role from my_access_requests()`)).toEqual({ status: "approved", granted_role: "teacher" });
  });

  it("an institute admin cannot make an institute admin, or decide another institute's request", async () => {
    await actAs(db, NEWBIE2);
    await db.query(`select request_access('${INST}', 'I run the office')`);
    await db.query(`select request_access('${OTHER}', 'student')`);
    await actAs(db, ADMIN);
    const id = (await one<{ id: string }>(`select id from institute_access_requests('${INST}')`)).id;
    await expect(db.query(`select decide_access_request('${id}', true, 'institute_admin')`)).rejects.toThrow(/only the platform/);
    await actAsOwner(db);
    const otherId = (await one<{ id: string }>(`select id from access_requests where institute_id = '${OTHER}' and user_id = '${NEWBIE2}'`)).id;
    await actAs(db, ADMIN);
    await expect(db.query(`select decide_access_request('${otherId}', true, 'student')`)).rejects.toThrow(/not authorised/);
  });

  it("the platform owner can make an institute admin, and it is logged", async () => {
    await actAs(db, OWNER);
    const pending = (await db.query<{ id: string; institute_name: string; username: string }>(`select id, institute_name, username from platform_access_requests_pending()`)).rows;
    const target = pending.find((p) => p.institute_name === "Sunrise" && p.username === "meera")!;
    await db.query(`select decide_access_request('${target.id}', true, 'institute_admin')`);
    await actAsOwner(db);
    expect(await n(`select count(*)::int as n from institute_members where user_id = '${NEWBIE2}' and institute_id = '${INST}' and role = 'institute_admin'`)).toBe(1);
    expect(await n(`select count(*)::int as n from platform_access_log where action = 'access_request_approved' and detail = 'as institute_admin'`)).toBe(1);
    expect(await n(`select count(*)::int as n from platform_access_log where action = 'read_access_requests'`)).toBeGreaterThan(0);
  });

  it("declining needs a reason the requester can read", async () => {
    await actAs(db, OTHER_ADMIN);
    const id = (await one<{ id: string }>(`select id from institute_access_requests('${OTHER}')`)).id;
    await expect(db.query(`select decide_access_request('${id}', false, null, '')`)).rejects.toThrow(/reason/);
    await db.query(`select decide_access_request('${id}', false, null, 'We only take class 12 this year')`);
    await actAs(db, NEWBIE2);
    const mine = (await db.query<{ institute_name: string; status: string; reason: string | null }>(`select institute_name, status, reason from my_access_requests()`)).rows;
    expect(mine.find((m) => m.institute_name === "Other")).toMatchObject({ status: "declined", reason: "We only take class 12 this year" });
  });

  it("a teacher cannot decide, nobody approves their own request, and a decided request stays decided", async () => {
    await actAs(db, NEWBIE3);
    const id = (await one<{ id: string }>(`select request_access('${INST}', null) as id`)).id;
    await actAs(db, TEACHER);
    await expect(db.query(`select decide_access_request('${id}', true, 'teacher')`)).rejects.toThrow(/not authorised/);
    await actAs(db, NEWBIE3);
    await expect(db.query(`select decide_access_request('${id}', true, 'institute_admin')`)).rejects.toThrow(/not authorised/);
    await actAs(db, ADMIN);
    await db.query(`select decide_access_request('${id}', true, 'student')`);
    await expect(db.query(`select decide_access_request('${id}', false, null, 'changed my mind')`)).rejects.toThrow(/already answered/);
  });

  it("the requester can withdraw a pending request", async () => {
    await actAs(db, NEWBIE3);
    const id = (await one<{ id: string }>(`select request_access('${OTHER}', null) as id`)).id;
    await db.query(`select withdraw_access_request('${id}')`);
    await expect(db.query(`select withdraw_access_request('${id}')`)).rejects.toThrow(/already answered/);
  });

  it("counts what is waiting for the platform, without logging", async () => {
    await actAs(db, OWNER);
    const before = await n(`select count(*)::int as n from platform_access_log`);
    await db.query(`select platform_pending_access_count()`);
    await actAsOwner(db);
    expect(await n(`select count(*)::int as n from platform_access_log`)).toBe(before);
    await actAs(db, ADMIN);
    await expect(db.query(`select platform_pending_access_count()`)).rejects.toThrow(/platform owner/);
  });
});
