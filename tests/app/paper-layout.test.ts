import { describe, expect, it } from "vitest";
import {
  availableFor,
  layoutTotals,
  marksOnOffer,
  QUICK_TEMPLATES,
  sectionFromKind,
  validateLayout,
  type AvailabilityRow,
} from "@/lib/paper-layout";

describe("quick templates", () => {
  it("all validate, and their marks add up to what their names say", () => {
    for (const t of QUICK_TEMPLATES) {
      const v = validateLayout(t.layout);
      expect(v.ok, `${t.key}: ${v.ok ? "" : v.message}`).toBe(true);
    }
    const marks = (key: string) => layoutTotals(QUICK_TEMPLATES.find((t) => t.key === key)!.layout.sections).marks;
    expect(marks("quiz-15")).toBe(10);
    expect(marks("mcq-100")).toBe(100);
    expect(marks("class-test-20")).toBe(20);
    expect(marks("unit-test-25")).toBe(25);
    expect(marks("chapter-test-40")).toBe(40);
    expect(marks("term-80")).toBe(80);
  });
});

describe("validateLayout", () => {
  const ok = { name: "My test", durationMin: 15, generalInstructions: "", sections: [sectionFromKind("mcq", 100, 1)] };

  it("accepts a 100-MCQ paper", () => {
    const v = validateLayout(ok);
    expect(v.ok).toBe(true);
    if (v.ok) expect(layoutTotals(v.layout.sections)).toEqual({ questions: 100, marks: 100 });
  });

  it("refuses what it cannot build, with a reason a teacher understands", () => {
    const bad = (patch: object, section: object = {}) => validateLayout({ ...ok, ...patch, sections: [{ ...ok.sections[0], ...section }] });
    expect(bad({ durationMin: 2 })).toMatchObject({ ok: false, message: expect.stringMatching(/between 5 and 360/) });
    expect(bad({}, { questionCount: 0 })).toMatchObject({ ok: false, message: expect.stringMatching(/Section A: number of questions/) });
    expect(bad({}, { questionCount: 201 })).toMatchObject({ ok: false });
    expect(bad({}, { marksEach: 1.5 })).toMatchObject({ ok: false, message: expect.stringMatching(/marks each/) });
    expect(bad({}, { questionTypes: ["essay-of-doom"] })).toMatchObject({ ok: false, message: expect.stringMatching(/question kind/) });
    expect(bad({}, { questionTypes: ["mcq", "case_study"] })).toMatchObject({ ok: false, message: expect.stringMatching(/cannot be mixed/) });
    expect(validateLayout({ ...ok, sections: [] })).toMatchObject({ ok: false, message: "Add at least one section." });
    expect(validateLayout({ ...ok, sections: [sectionFromKind("mcq", 150, 1), sectionFromKind("mcq", 60, 1)] })).toMatchObject({ ok: false, message: expect.stringMatching(/at most 200 questions/) });
  });

  it("decides passage-ness from the kind, not from what the browser claims", () => {
    const v = validateLayout({ ...ok, sections: [{ ...sectionFromKind("case_study", 2, 4), requiresStimulus: false }] });
    expect(v.ok && v.layout.sections[0]!.requiresStimulus).toBe(true);
  });

  it("drops unknown fields and fills default instructions", () => {
    const v = validateLayout({ ...ok, evil: true, sections: [{ ...ok.sections[0], instructions: "  ", ownerInstituteId: "x" }] });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(Object.keys(v.layout).sort()).toEqual(["durationMin", "generalInstructions", "name", "sections"]);
    expect(v.layout.sections[0]!.instructions).toBe("MCQ only (1 mark each).");
    expect(v.layout.sections[0]).not.toHaveProperty("ownerInstituteId");
  });
});

describe("availability", () => {
  const rows: AvailabilityRow[] = [
    { types: ["mcq"], marks: 1, stimulus: false, count: 54 },
    { types: ["assertion_reason"], marks: 1, stimulus: false, count: 21 },
    { types: ["vsa"], marks: 2, stimulus: false, count: 32 },
    { types: ["sa"], marks: 3, stimulus: false, count: 24 },
    { types: ["case_study"], marks: 4, stimulus: true, count: 8 },
  ];
  it("counts what a section could draw from", () => {
    expect(availableFor(sectionFromKind("objective", 1, 1), rows)).toBe(75);
    expect(availableFor(sectionFromKind("mcq", 1, 1), rows)).toBe(54);
    expect(availableFor(sectionFromKind("written", 1, 2), rows)).toBe(32);
    expect(availableFor(sectionFromKind("written", 1, 1), rows)).toBe(0);
    expect(availableFor(sectionFromKind("case_study", 1, 4), rows)).toBe(8);
  });
  it("offers the marks values that exist for a kind", () => {
    expect(marksOnOffer(sectionFromKind("written", 1, 2), rows)).toEqual([{ marks: 2, count: 32 }, { marks: 3, count: 24 }]);
  });
});
