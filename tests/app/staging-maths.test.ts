import { describe, expect, it } from "vitest";
import { mathsQuestion } from "../../scripts/staging/maths";
import { renderRich } from "../../src/lib/print/math";

describe("staging maths questions", () => {
  it("cover all 14 chapters and every question type, with the right marks", () => {
    const seen = new Map<string, number>();
    for (let ch = 1; ch <= 14; ch++) for (let g = 1; g <= 20; g++) {
      const q = mathsQuestion(ch, 1, g);
      seen.set(q.type, q.marks);
    }
    expect(Object.fromEntries(seen)).toEqual({ mcq: 1, vsa: 1, sa: 2, la: 5 });
  });

  it("mark the correct option on every MCQ, among four distinct options", () => {
    for (let ch = 1; ch <= 14; ch++) for (let k = 1; k <= 3; k++) for (let g = 1; g <= 20; g++) {
      const q = mathsQuestion(ch, k, g);
      if (q.type !== "mcq") continue;
      const texts = q.options!.map((o) => o.text);
      expect(new Set(texts).size, `ch${ch} t${k} g${g}: ${texts.join(" | ")}`).toBe(4);
      expect(q.options!.find((o) => o.key === q.correct)!.text).toBe(q.answer);
    }
  });

  it("compute answers that are actually right (spot checks)", () => {
    const q1 = mathsQuestion(1, 1, 5); // vsa, n=5 → a=7 → HCF of 42 and 63 = 21
    expect(q1.body).toContain("$42$");
    expect(q1.answer).toContain("$21$");
    const ap = mathsQuestion(5, 1, 4); // n=4 → a=6, b=5, t=9 → 5 + 8*6 = 53
    expect(ap.answer).toContain("a_{9} = 53");
  });

  it("render as maths without errors", () => {
    for (let ch = 1; ch <= 14; ch++) for (let g = 1; g <= 10; g++) {
      const q = mathsQuestion(ch, 2, g);
      for (const text of [q.body, q.answer, ...(q.options ?? []).map((o) => o.text)]) {
        const html = renderRich(text);
        expect(html, `ch${ch} g${g}: ${text}`).not.toContain("katex-error");
        expect(html).not.toMatch(/\$/);
      }
    }
  });
});
