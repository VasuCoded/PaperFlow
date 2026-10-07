import { describe, expect, it } from "vitest";
import { effectiveModules, MODULES } from "@/lib/modules";

describe("modules", () => {
  it("defaults to everything on except self-practice", () => {
    expect(effectiveModules({})).toEqual({ student_app: true, teachers: true, self_practice: false });
    expect(effectiveModules(null)).toEqual(effectiveModules({}));
  });

  it("switches a module off, and anything that needs it with it", () => {
    expect(effectiveModules({ student_app: false, self_practice: true })).toEqual({
      student_app: false, teachers: true, self_practice: false,
    });
  });

  it("ignores values that are not true/false", () => {
    expect(effectiveModules({ teachers: "no" }).teachers).toBe(true);
  });

  it("matches the database's defaults (module_enabled in migration 0029)", () => {
    const sql = MODULES.map((m) => `${m.key}:${m.defaultOn}`).join(",");
    expect(sql).toBe("student_app:true,teachers:true,self_practice:false");
  });
});
