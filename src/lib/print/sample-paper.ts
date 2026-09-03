import type { CanonPaper } from "./compose";

/**
 * Canonical Class 10 Science unit test (25 marks). Authored ONCE, in canonical
 * order; the shuffle engine derives each printed set from it.
 *
 * options_shufflable is set per question, not globally: it is false wherever
 * the options carry a numeric or sign ordering a student could reason from,
 * and true only where the options are genuinely independent (§3.1).
 */
export const SAMPLE_SCIENCE_PAPER: CanonPaper = {
  instituteName: "Sunrise Coaching Classes",
  instituteLogoUrl: null,
  className: "10",
  subjectName: "Science",
  title: "Unit Test 1 — Reactions, Light & Current",
  totalMarks: 25,
  durationMin: 60,
  sections: [
    {
      label: "A",
      instructions: "Objective questions. 1 mark each.",
      blocks: [
        {
          key: "a1",
          questions: [
            {
              body: "Which of the following is a displacement reaction?",
              marks: 1,
              optionsShufflable: true,
              correctOption: "A",
              options: [
                { key: "A", text: "$\\ce{Fe + CuSO4 -> FeSO4 + Cu}$" },
                { key: "B", text: "$\\ce{H2 + Cl2 -> 2HCl}$" },
                { key: "C", text: "$\\ce{CaCO3 ->[\\Delta] CaO + CO2}$" },
                { key: "D", text: "$\\ce{NaOH + HCl -> NaCl + H2O}$" },
              ],
            },
          ],
        },
        {
          key: "a2",
          questions: [
            {
              body:
                "An object is placed $20\\ \\mathrm{cm}$ in front of a concave mirror of focal " +
                "length $15\\ \\mathrm{cm}$. The image distance $v$ is:",
              marks: 1,
              // signed magnitudes read as an ordered list — do not shuffle
              optionsShufflable: false,
              correctOption: "B",
              options: [
                { key: "A", text: "$+60\\ \\mathrm{cm}$" },
                { key: "B", text: "$-60\\ \\mathrm{cm}$" },
                { key: "C", text: "$-8.6\\ \\mathrm{cm}$" },
                { key: "D", text: "$+8.6\\ \\mathrm{cm}$" },
              ],
            },
          ],
        },
        {
          key: "a3",
          questions: [
            {
              body:
                "Three resistors of $2\\,\\Omega$, $3\\,\\Omega$ and $6\\,\\Omega$ are connected " +
                "in parallel. The equivalent resistance is:",
              marks: 1,
              optionsShufflable: true,
              correctOption: "A",
              options: [
                { key: "A", text: "$1\\,\\Omega$" },
                { key: "B", text: "$11\\,\\Omega$" },
                { key: "C", text: "$\\frac{11}{6}\\,\\Omega$" },
                { key: "D", text: "$\\frac{6}{11}\\,\\Omega$" },
              ],
            },
          ],
        },
        {
          key: "a4",
          questions: [
            {
              body: "In the reaction $\\ce{ZnO + C -> Zn + CO}$, the substance oxidised is:",
              marks: 1,
              optionsShufflable: true,
              correctOption: "C",
              options: [
                { key: "A", text: "$\\ce{ZnO}$" },
                { key: "B", text: "$\\ce{Zn}$" },
                { key: "C", text: "$\\ce{C}$" },
                { key: "D", text: "$\\ce{CO}$" },
              ],
            },
          ],
        },
        {
          key: "a5",
          questions: [
            {
              body:
                "The refractive index of glass is $1.5$ and the speed of light in vacuum is " +
                "$3\\times10^{8}\\ \\mathrm{m\\,s^{-1}}$. The speed of light in glass is:",
              marks: 1,
              optionsShufflable: false,
              correctOption: "B",
              options: [
                { key: "A", text: "$1.5\\times10^{8}\\ \\mathrm{m\\,s^{-1}}$" },
                { key: "B", text: "$2\\times10^{8}\\ \\mathrm{m\\,s^{-1}}$" },
                { key: "C", text: "$3\\times10^{8}\\ \\mathrm{m\\,s^{-1}}$" },
                { key: "D", text: "$4.5\\times10^{8}\\ \\mathrm{m\\,s^{-1}}$" },
              ],
            },
          ],
        },
        {
          key: "a6",
          questions: [
            {
              body: "A solution turns blue litmus red. Its pH is most likely:",
              marks: 1,
              optionsShufflable: false,
              correctOption: "A",
              options: [
                { key: "A", text: "$3$" },
                { key: "B", text: "$7$" },
                { key: "C", text: "$9$" },
                { key: "D", text: "$11$" },
              ],
            },
          ],
        },
        {
          key: "a7",
          questions: [
            {
              body:
                "An electric bulb draws $0.5\\ \\mathrm{A}$ at $220\\ \\mathrm{V}$. Its power is:",
              marks: 1,
              optionsShufflable: false,
              correctOption: "C",
              options: [
                { key: "A", text: "$44\\ \\mathrm{W}$" },
                { key: "B", text: "$55\\ \\mathrm{W}$" },
                { key: "C", text: "$110\\ \\mathrm{W}$" },
                { key: "D", text: "$440\\ \\mathrm{W}$" },
              ],
            },
          ],
        },
        {
          key: "a8",
          questions: [
            {
              body: "The power of a convex lens of focal length $50\\ \\mathrm{cm}$ is:",
              marks: 1,
              optionsShufflable: false,
              correctOption: "B",
              options: [
                { key: "A", text: "$+0.5\\ \\mathrm{D}$" },
                { key: "B", text: "$+2\\ \\mathrm{D}$" },
                { key: "C", text: "$-2\\ \\mathrm{D}$" },
                { key: "D", text: "$+50\\ \\mathrm{D}$" },
              ],
            },
          ],
        },
      ],
    },
    {
      label: "B",
      instructions: "Short answer. 3 marks each. Show your working.",
      blocks: [
        {
          key: "b1",
          questions: [
            {
              body:
                "Balance the equation and identify the type of reaction:\n" +
                "$$\\ce{Fe + H2O -> Fe3O4 + H2}$$",
              marks: 3,
              answer: "$\\ce{3Fe + 4H2O -> Fe3O4 + 4H2}$ — displacement",
            },
          ],
        },
        {
          key: "b2",
          questions: [
            {
              body:
                "A convex lens forms a real image at $30\\ \\mathrm{cm}$ when the object is at " +
                "$20\\ \\mathrm{cm}$. Using $$\\frac{1}{f} = \\frac{1}{v} - \\frac{1}{u}$$ " +
                "find the focal length $f$ and the magnification $m$.",
              marks: 3,
              answer: "$f = 12\\ \\mathrm{cm}$, $m = -1.5$",
            },
          ],
        },
        {
          key: "b3",
          questions: [
            {
              body:
                "Two resistors $4\\,\\Omega$ and $6\\,\\Omega$ are joined in series across a " +
                "$12\\ \\mathrm{V}$ battery. Find the current and the potential difference " +
                "across the $6\\,\\Omega$ resistor.",
              marks: 3,
              answer: "$I = 1.2\\ \\mathrm{A}$, $V = 7.2\\ \\mathrm{V}$",
            },
          ],
        },
        {
          key: "b4",
          questions: [
            {
              body:
                "Why does copper not displace zinc from zinc sulphate solution? Support your " +
                "answer with the relevant part of the reactivity series.",
              marks: 3,
              answer: "Cu is below Zn in the reactivity series — no displacement",
            },
          ],
        },
      ],
    },
    {
      label: "C",
      instructions: "Case-based question. Read the passage and answer.",
      blocks: [
        {
          key: "c1",
          stimulus: {
            kind: "case_study",
            body:
              "A strip of copper is dipped into silver nitrate solution. Over an hour the " +
              "colourless solution turns pale blue and a greyish-white deposit forms on the " +
              "copper. In a separate circuit the same student passes $1.5\\ \\mathrm{A}$ " +
              "through a $4\\,\\Omega$ coil.",
          },
          questions: [
            {
              partLabel: "(a)",
              body: "Write the balanced equation for the reaction and name its type.",
              marks: 2,
              answer: "$\\ce{Cu + 2AgNO3 -> Cu(NO3)2 + 2Ag}$ — displacement",
            },
            {
              partLabel: "(b)",
              body: "Explain why the solution turns blue.",
              marks: 2,
              answer: "$\\ce{Cu^2+}$ ions pass into solution",
            },
            {
              partLabel: "(c)",
              body: "Using $P = I^{2}R$, calculate the power dissipated in the coil.",
              marks: 1,
              answer: "$P = (1.5)^2 \\times 4 = 9\\ \\mathrm{W}$",
            },
          ],
        },
      ],
    },
  ],
};
