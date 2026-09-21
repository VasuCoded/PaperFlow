import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const updateUserById = vi.fn();
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { updateUserById } },
    from: () => ({ insert: async () => ({ error: null }) }),
  }),
}));

const { resetPassword, temporaryPassword } = await import("@/server/passwords");
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
