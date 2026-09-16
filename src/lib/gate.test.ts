import { describe, expect, it } from "vitest";
import { gateStatus } from "./gate";

const base = { approved: 1400, chapters: 14, thinnest_chapter: "Light", thinnest_chapter_count: 72, thinnest_topic_count: 9 };

describe("gateStatus", () => {
  it("is met when every chapter and topic clears its minimum", () => {
    expect(gateStatus(base)).toEqual({ met: true, gaps: [] });
  });

  it("names the thinnest chapter when it is under 60", () => {
    const g = gateStatus({ ...base, thinnest_chapter_count: 41 });
    expect(g.met).toBe(false);
    expect(g.gaps[0]).toContain("Light has 41");
  });

  it("reports a thin topic separately", () => {
    const g = gateStatus({ ...base, thinnest_topic_count: 3 });
    expect(g.met).toBe(false);
    expect(g.gaps).toEqual(["Thinnest topic has 3 (needs 8)"]);
  });

  it("is not met for a class-subject with no chapters, whatever the counts say", () => {
    expect(gateStatus({ ...base, chapters: 0 }).met).toBe(false);
  });

  it("does not fail a subject that has no topics defined", () => {
    expect(gateStatus({ ...base, thinnest_topic_count: null }).met).toBe(true);
  });
});
