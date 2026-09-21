/**
 * Synthetic Class 10 Mathematics questions for the staging dataset, one
 * template per NCERT chapter, with the numbers varied per question and the
 * answers COMPUTED — so every answer key, and every MCQ's marked option, is
 * actually right. Maths is written in the bank's TeX format ($...$).
 *
 * Question type follows the item number g within a topic, as elsewhere in
 * the seed: g%10 in 1-3 → mcq (1 mark), 4-5 → vsa (1), 6-8 → sa (2),
 * 9-10 → la (5).
 */

export interface MathsQuestion {
  body: string;
  type: "mcq" | "vsa" | "sa" | "la";
  options: { key: string; text: string }[] | null;
  correct: string | null;
  answer: string;
  solution: string;
  marks: number;
  difficulty: "easy" | "medium" | "hard";
}

interface Template {
  /** the question at its core (vsa / sa) */
  stem: string;
  answer: string;
  /** the one-mark MCQ version */
  mcq: { stem: string; correct: string; wrong: [string, string, string] };
  /** the second part that makes it a 5-mark long answer */
  more: { stem: string; answer: string };
}

const m = (s: string | number) => `$${s}$`;
const frac = (p: number, q: number) => {
  const g = gcd(p, q);
  const [a, b] = [p / g, q / g];
  return b === 1 ? `${a}` : `\\frac{${a}}{${b}}`;
};
function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}
const signed = (v: number) => (v < 0 ? `- ${-v}` : `+ ${v}`);
const num = (v: number) => (Number.isInteger(v) ? `${v}` : v.toFixed(1));

function template(chapter: number, n: number): Template {
  const a = (n % 7) + 2; // 2..8
  const b = (n % 5) + 1; // 1..5
  const c = (n % 4) + 1; // 1..4

  switch (chapter) {
    case 1: {
      const p = 6 * a, q = 9 * a;
      return {
        stem: `Find the HCF of ${m(p)} and ${m(q)} using prime factorisation.`,
        answer: `HCF = ${m(3 * a)}`,
        mcq: { stem: `The HCF of ${m(p)} and ${m(q)} is`, correct: m(3 * a), wrong: [m(a), m(6 * a), m(18 * a)] },
        more: { stem: `Hence find their LCM and verify that $\\text{HCF} \\times \\text{LCM}$ equals the product of the two numbers.`, answer: `LCM = ${m(18 * a)}; ${m(`${3 * a} \\times ${18 * a} = ${p} \\times ${q} = ${p * q}`)}` },
      };
    }
    case 2: {
      const s = a + b, pr = a * b;
      const lo = Math.min(a, b), hi = Math.max(a, b);
      return {
        stem: `Find the zeroes of the polynomial ${m(`p(x) = x^2 - ${s}x + ${pr}`)}.`,
        answer: `${m(lo)} and ${m(hi)}`,
        mcq: { stem: `The sum of the zeroes of ${m(`x^2 - ${s}x + ${pr}`)} is`, correct: m(s), wrong: [m(-s), m(pr), m(s + 1)] },
        more: { stem: `Verify the relationship between the zeroes and the coefficients.`, answer: `Sum ${m(`= ${s} = -\\frac{-${s}}{1}`)}, product ${m(`= ${pr} = \\frac{${pr}}{1}`)}` },
      };
    }
    case 3: {
      return {
        stem: `Solve the pair of linear equations ${m(`x + y = ${a + b}`)} and ${m(`x - y = ${a - b}`)}.`,
        answer: `${m(`x = ${a}`)}, ${m(`y = ${b}`)}`,
        mcq: { stem: `If ${m(`x + y = ${a + b}`)} and ${m(`x - y = ${a - b}`)}, then ${m("x")} is`, correct: m(a), wrong: [m(b), m(a + b), m(a - b === a ? a + 1 : a - b)] },
        more: { stem: `Draw the graphs of both equations and show that they intersect at the solution you found.`, answer: `The lines meet at ${m(`(${a}, ${b})`)}` },
      };
    }
    case 4: {
      const s = a + b, pr = a * b, d = (a - b) ** 2;
      const lo = Math.min(a, b), hi = Math.max(a, b);
      return {
        stem: `Find the roots of the quadratic equation ${m(`x^2 - ${s}x + ${pr} = 0`)} by factorisation.`,
        answer: `${m(`x = ${lo}`)} or ${m(`x = ${hi}`)}`,
        mcq: { stem: `The discriminant of ${m(`x^2 - ${s}x + ${pr} = 0`)} is`, correct: m(d), wrong: [m(d + 4), m(s * s), m(4 * pr)] },
        more: { stem: `Find its discriminant and state the nature of the roots.`, answer: `${m(`D = ${d}`)}; the roots are ${d === 0 ? "real and equal" : "real and distinct"}` },
      };
    }
    case 5: {
      const t = (n % 10) + 5;
      const nth = b + (t - 1) * a;
      const sum = (t * (2 * b + (t - 1) * a)) / 2;
      return {
        stem: `Find the ${m(`${t}^{\\text{th}}`)} term of the AP ${m(`${b}, ${b + a}, ${b + 2 * a}, \\ldots`)}`,
        answer: m(`a_{${t}} = ${nth}`),
        mcq: { stem: `The common difference of the AP ${m(`${b}, ${b + a}, ${b + 2 * a}, \\ldots`)} is`, correct: m(a), wrong: [m(b), m(-a), m(a + b)] },
        more: { stem: `Find the sum of its first ${m(t)} terms.`, answer: m(`S_{${t}} = ${num(sum)}`) },
      };
    }
    case 6: {
      return {
        stem: `In ${m("\\triangle ABC")}, ${m("DE \\parallel BC")}. If ${m(`AD = ${a}`)} cm, ${m(`DB = ${b}`)} cm and ${m(`AE = ${2 * a}`)} cm, find ${m("EC")}.`,
        answer: m(`EC = ${2 * b}\\text{ cm}`),
        mcq: { stem: `In ${m("\\triangle ABC")}, ${m("DE \\parallel BC")}, ${m(`AD = ${a}`)}, ${m(`DB = ${b}`)}, ${m(`AE = ${2 * a}`)}. Then ${m("EC")} equals`, correct: m(2 * b), wrong: [m(b), m(2 * a), m(a + b)] },
        more: { stem: `Find the ratio of the areas of ${m("\\triangle ADE")} and ${m("\\triangle ABC")}.`, answer: m(`${a}^2 : ${a + b}^2 = ${a * a} : ${(a + b) ** 2}`) },
      };
    }
    case 7: {
      const [x1, y1, x2, y2] = [b, c, b + 3 * a, c + 4 * a];
      return {
        stem: `Find the distance between the points ${m(`P(${x1}, ${y1})`)} and ${m(`Q(${x2}, ${y2})`)}.`,
        answer: m(`PQ = ${5 * a}`),
        mcq: { stem: `The distance between ${m(`(${x1}, ${y1})`)} and ${m(`(${x2}, ${y2})`)} is`, correct: m(5 * a), wrong: [m(7 * a), m(4 * a), m(`\\sqrt{${7 * a}}`)] },
        more: { stem: `Find the mid-point of ${m("PQ")}.`, answer: m(`\\left(${num((x1 + x2) / 2)}, ${num((y1 + y2) / 2)}\\right)`) },
      };
    }
    case 8: {
      const [p, q, r] = ([[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]] as const)[n % 4]!;
      return {
        stem: `If ${m(`\\sin A = \\frac{${p}}{${r}}`)}, find ${m("\\cos A")} and ${m("\\tan A")}.`,
        answer: `${m(`\\cos A = \\frac{${q}}{${r}}`)}, ${m(`\\tan A = \\frac{${p}}{${q}}`)}`,
        mcq: { stem: `If ${m(`\\sin A = \\frac{${p}}{${r}}`)}, then ${m("\\cos A")} is`, correct: m(`\\frac{${q}}{${r}}`), wrong: [m(`\\frac{${p}}{${q}}`), m(`\\frac{${r}}{${q}}`), m(`\\frac{${q}}{${p}}`)] },
        more: { stem: `Verify that ${m("\\sin^2 A + \\cos^2 A = 1")}.`, answer: m(`\\frac{${p * p}}{${r * r}} + \\frac{${q * q}}{${r * r}} = 1`) },
      };
    }
    case 9: {
      const h = 10 * a;
      return {
        stem: `The angle of elevation of the top of a tower from a point ${m(`${h}\\sqrt{3}`)} m from its foot is ${m("30^\\circ")}. Find the height of the tower.`,
        answer: m(`${h}\\text{ m}`),
        mcq: { stem: `A tower is ${m(h)} m high. From a point ${m(h)} m from its foot, the angle of elevation of its top is`, correct: m("45^\\circ"), wrong: [m("30^\\circ"), m("60^\\circ"), m("90^\\circ")] },
        more: { stem: `Find the angle of elevation of the top from a point ${m(h)} m from the foot.`, answer: m("45^\\circ") },
      };
    }
    case 10: {
      return {
        stem: `Find the length of the tangent drawn to a circle of radius ${m(3 * a)} cm from a point ${m(5 * a)} cm from its centre.`,
        answer: m(`${4 * a}\\text{ cm}`),
        mcq: { stem: `The tangent from a point ${m(5 * a)} cm from the centre of a circle of radius ${m(3 * a)} cm has length`, correct: m(4 * a), wrong: [m(2 * a), m(8 * a), m(`\\sqrt{${34 * a * a}}`)] },
        more: { stem: `Prove that the two tangents drawn from this point are equal in length.`, answer: `Both tangents are ${m(`${4 * a}`)} cm (congruent right triangles, RHS)` },
      };
    }
    case 11: {
      const r = 7 * a;
      return {
        stem: `Find the area of a sector of angle ${m("90^\\circ")} in a circle of radius ${m(r)} cm. (Use ${m("\\pi = \\frac{22}{7}")}.)`,
        answer: m(`${num((77 * a * a) / 2)}\\text{ cm}^2`),
        mcq: { stem: `The length of the arc of a ${m("90^\\circ")} sector of radius ${m(r)} cm is (Use ${m("\\pi = \\frac{22}{7}")})`, correct: m(`${11 * a}\\text{ cm}`), wrong: [m(`${22 * a}\\text{ cm}`), m(`${44 * a}\\text{ cm}`), m(`${7 * a}\\text{ cm}`)] },
        more: { stem: `Find the length of its arc.`, answer: m(`${11 * a}\\text{ cm}`) },
      };
    }
    case 12: {
      const h = 3 * a;
      return {
        stem: `Find the volume of a cone of base radius ${m(7)} cm and height ${m(h)} cm. (Use ${m("\\pi = \\frac{22}{7}")}.)`,
        answer: m(`${154 * a}\\text{ cm}^3`),
        mcq: { stem: `The volume of a cone of radius ${m(7)} cm and height ${m(h)} cm is`, correct: m(`${154 * a}\\text{ cm}^3`), wrong: [m(`${462 * a}\\text{ cm}^3`), m(`${77 * a}\\text{ cm}^3`), m(`${308 * a}\\text{ cm}^3`)] },
        more: { stem: `Find the volume of a cylinder with the same base and height, and compare.`, answer: `${m(`${462 * a}\\text{ cm}^3`)}, three times the cone` },
      };
    }
    case 13: {
      const xs = [0, 1, 2, 3, 4].map((i) => b + i * a);
      return {
        stem: `Find the mean of ${m(xs.join(", "))}.`,
        answer: m(`\\bar{x} = ${b + 2 * a}`),
        mcq: { stem: `The median of ${m(xs.join(", "))} is`, correct: m(b + 2 * a), wrong: [m(b + a), m(b + 3 * a), m(5 * b)] },
        more: { stem: `Find the median and the range of the data.`, answer: `Median ${m(b + 2 * a)}, range ${m(4 * a)}` },
      };
    }
    default: {
      const k = (n % 5) + 1;
      return {
        stem: `A die is thrown once. Find the probability of getting a number greater than ${m(k)}.`,
        answer: m(frac(6 - k, 6)),
        mcq: { stem: `A die is thrown once. The probability of getting a number greater than ${m(k)} is`, correct: m(frac(6 - k, 6)), wrong: [m(frac(k, 6)), m(frac(7 - k, 6)), m("1")] },
        more: { stem: `Find the probability of getting an even number.`, answer: m("\\frac{1}{2}") },
      };
    }
  }
}

/**
 * Three distractors, none equal to the answer or to each other. The chapter
 * templates' own distractors can coincide for some numbers (sum 5, product 6,
 * "sum + 1" = 6), so fall back to nearby values, then to generic ones.
 */
function distinctWrong(correct: string, preferred: readonly string[]): string[] {
  const out: string[] = [];
  const take = (s: string) => {
    if (out.length < 3 && s !== correct && !out.includes(s)) out.push(s);
  };
  preferred.forEach(take);
  const numeric = /^\$(-?\d+(?:\.\d+)?)\$$/.exec(correct);
  if (numeric) {
    const v = Number(numeric[1]);
    for (const d of [1, -1, 2, -2, 3, 5, 10]) take(`$${num(v + d)}$`);
  }
  for (const s of ["$0$", "$1$", "$\\frac{1}{3}$", "$\\frac{2}{3}$", "$\\frac{5}{6}$", "$2$", "$-1$"]) take(s);
  return out;
}

/**
 * Question number `g` (1-based) of `topic` (1-3) in `chapter` (1-14).
 * `salt` shifts the numbers so private and review questions differ from the
 * shared ones.
 */
export function mathsQuestion(chapter: number, topic: number, g: number, salt = 0): MathsQuestion {
  const n = (topic - 1) * 20 + g + salt;
  const t = template(chapter, n);
  const slot = (g - 1) % 10;
  const difficulty = (["easy", "medium", "hard"] as const)[(g + chapter) % 3]!;

  if (slot < 3) {
    const keys = ["A", "B", "C", "D"];
    const correctKey = keys[n % 4]!;
    const wrong = distinctWrong(t.mcq.correct, t.mcq.wrong);
    const options = keys.map((key) => ({ key, text: key === correctKey ? t.mcq.correct : wrong.shift()! }));
    return { body: t.mcq.stem, type: "mcq", options, correct: correctKey, answer: t.mcq.correct, solution: `Correct option: (${correctKey}) ${t.mcq.correct}`, marks: 1, difficulty };
  }
  if (slot < 5) {
    return { body: t.stem, type: "vsa", options: null, correct: null, answer: t.answer, solution: t.answer, marks: 1, difficulty };
  }
  if (slot < 8) {
    return { body: `${t.stem} Show your working.`, type: "sa", options: null, correct: null, answer: t.answer, solution: `Working leads to: ${t.answer}`, marks: 2, difficulty };
  }
  return {
    body: `(i) ${t.stem} (ii) ${t.more.stem}`,
    type: "la",
    options: null,
    correct: null,
    answer: `(i) ${t.answer}; (ii) ${t.more.answer}`,
    solution: `(i) ${t.answer}. (ii) ${t.more.answer}.`,
    marks: 5,
    difficulty,
  };
}
