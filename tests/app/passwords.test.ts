import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const updateUserById = vi.fn();
/** institute_members rows the fake service-role client can see; `fail` simulates a read error */
const members: { user_id: string; institute_id: string }[] = [];
let fail = false;
/** A chainable stand-in for the query builder, enough for belongsOnlyTo's .eq/.neq/.limit. */
function membersQuery() {
  let rows = [...members];
  const q = {
    select: () => q,
    eq: (col: "user_id" | "institute_id", v: string) => ((rows = rows.filter((r) => r[col] === v)), q),
    neq: (col: "user_id" | "institute_id", v: string) => ((rows = rows.filter((r) => r[col] !== v)), q),
    limit: async (n: number) => (fail ? { data: null, error: { message: "boom" } } : { data: rows.slice(0, n), error: null }),
  };
  return q;
}
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { updateUserById } },
    from: (table: string) => (table === "institute_members" ? membersQuery() : { insert: async () => ({ error: null }) }),
  }),
}));

const { belongsOnlyTo, resetPassword, temporaryPassword } = await import("@/server/passwords");
const { passwordProblem } = await import("@/lib/identity");

describe("temporary passwords", () => {
  it("are readable, varied, and always acceptable passwords", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const pw = temporaryPassword();
      expect(pw).toMatch(/^[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}$/);
      expect(passwordProblem(pw)).toBeNull();
      seen.add(pw);
    }
    expect(seen.size).toBe(200);
  });
});

describe("resetPassword", () => {
  it("refuses Google accounts without touching Supabase", async () => {
    updateUserById.mockClear();
    const res = await resetPassword({ userId: "u", targetEmail: "someone@gmail.com", actorId: "a", instituteId: null, action: "password_reset_by_platform" });
    expect(res.ok).toBe(false);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("sets a new password on a username account", async () => {
    updateUserById.mockResolvedValue({ error: null });
    const res = await resetPassword({ userId: "u", targetEmail: "ravi@users.paperflow.invalid", actorId: "a", instituteId: "i", action: "password_reset_by_institute_admin" });
    expect(res.ok).toBe(true);
    expect(updateUserById).toHaveBeenCalledWith("u", { password: res.ok ? res.password : "" });
  });
});

describe("belongsOnlyTo (who an institute admin may reset)", () => {
  const A = "inst-a";
  const B = "inst-b";
  const PLATFORM = "11111111-1111-1111-1111-111111111111";

  it("allows a person whose only membership is this institute", async () => {
    members.splice(0, members.length, { user_id: "s1", institute_id: A });
    fail = false;
    expect(await belongsOnlyTo("s1", A)).toBe(true);
  });

  it("refuses a student who is also enrolled at another institute", async () => {
    members.splice(0, members.length, { user_id: "s2", institute_id: A }, { user_id: "s2", institute_id: B });
    expect(await belongsOnlyTo("s2", A)).toBe(false);
  });

  it("refuses the platform owner, even if they hold a student seat here", async () => {
    members.splice(0, members.length, { user_id: "owner", institute_id: A }, { user_id: "owner", institute_id: PLATFORM });
    expect(await belongsOnlyTo("owner", A)).toBe(false);
  });

  it("is not fooled by other people's memberships elsewhere", async () => {
    members.splice(0, members.length, { user_id: "s3", institute_id: A }, { user_id: "someone-else", institute_id: B });
    expect(await belongsOnlyTo("s3", A)).toBe(true);
  });

  it("refuses when the check itself cannot be read", async () => {
    members.splice(0, members.length, { user_id: "s4", institute_id: A });
    fail = true;
    expect(await belongsOnlyTo("s4", A)).toBe(false);
    fail = false;
  });
});
