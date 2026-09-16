/**
 * Demo question bank. Real CBSE-style content so the generator has something
 * honest to select from; the counts and history around it are invented.
 *
 * Ownership matters here exactly as it does in production: most rows belong to
 * the platform institute (the shared bank) and a few belong to a tenant (its
 * private layer). The teacher screen marks the private ones.
 */
import type { Difficulty, GenQuestion } from "@/server/generator/types";
import type { BankItem, DemoChapter, DemoClassSubject } from "./types";
import { PLATFORM_ID, SUNRISE_ID } from "./institutes";

export const CS_BIO = "cs-12-bio";
export const CS_CHEM = "cs-12-chem";
export const CS_SCI = "cs-10-sci";
export const CS_MATH = "cs-10-math";
export const CS_HINDI = "cs-10-hindi";
export const CS_SST = "cs-10-sst";

export const CLASS_SUBJECTS: DemoClassSubject[] = [
  { id: CS_BIO, className: "12", subjectName: "Biology", short: "BIO", script: "latin", bankStatus: "ready", approved: 1183 },
  { id: CS_CHEM, className: "12", subjectName: "Chemistry", short: "CHE", script: "latin", bankStatus: "ready", approved: 731 },
  { id: CS_SCI, className: "10", subjectName: "Science", short: "SCI", script: "latin", bankStatus: "ready", approved: 964 },
  { id: CS_MATH, className: "10", subjectName: "Mathematics", short: "MAT", script: "latin", bankStatus: "seeding", approved: 402 },
  { id: CS_SST, className: "10", subjectName: "Social Science", short: "SST", script: "latin", bankStatus: "seeding", approved: 288 },
  { id: CS_HINDI, className: "10", subjectName: "Hindi", short: "HIN", script: "devanagari", bankStatus: "planned", approved: 41 },
];

export const CHAPTERS: DemoChapter[] = [
  { id: "bio-inh", classSubjectId: CS_BIO, name: "Principles of Inheritance and Variation", approved: 412 },
  { id: "bio-mol", classSubjectId: CS_BIO, name: "Molecular Basis of Inheritance", approved: 508 },
  { id: "bio-evo", classSubjectId: CS_BIO, name: "Evolution", approved: 263 },
  { id: "bio-hhd", classSubjectId: CS_BIO, name: "Human Health and Disease", approved: 341 },
  { id: "bio-btp", classSubjectId: CS_BIO, name: "Biotechnology — Principles and Processes", approved: 47 },
  { id: "sci-crx", classSubjectId: CS_SCI, name: "Chemical Reactions and Equations", approved: 210 },
  { id: "sci-acd", classSubjectId: CS_SCI, name: "Acids, Bases and Salts", approved: 188 },
  { id: "sci-lgt", classSubjectId: CS_SCI, name: "Light — Reflection and Refraction", approved: 241 },
  { id: "sci-ele", classSubjectId: CS_SCI, name: "Electricity", approved: 233 },
  { id: "sci-lif", classSubjectId: CS_SCI, name: "Life Processes", approved: 52 },
];

let seq = 0;
function mk(
  chapterId: string,
  topicName: string,
  body: string,
  marks: number,
  difficulty: Difficulty,
  source: string,
  classSubjectId: string,
  extra: Partial<BankItem> = {},
): BankItem {
  return {
    id: `q${++seq}`,
    ownerInstituteId: PLATFORM_ID,
    classSubjectId,
    chapterId,
    topicName,
    body,
    marks,
    difficulty,
    source,
    ...extra,
  };
}

const bio = (
  ch: string, topic: string, body: string, marks: number,
  d: Difficulty, src: string, extra: Partial<BankItem> = {},
) => mk(ch, topic, body, marks, d, src, CS_BIO, extra);

const sci = (
  ch: string, topic: string, body: string, marks: number,
  d: Difficulty, src: string, extra: Partial<BankItem> = {},
) => mk(ch, topic, body, marks, d, src, CS_SCI, extra);

// ---------------------------------------------------------------------------
// Class 12 Biology — the showcase subject (matches the pitch demo)
// ---------------------------------------------------------------------------
export const BIOLOGY_BANK: BankItem[] = [
  // ---- 1 mark ----
  bio("bio-inh", "Dihybrid ratios", "In a dihybrid cross, a 9:3:3:1 phenotypic ratio in F₂ indicates that the two genes are…", 1, "easy", "Board 2019", { optionsShufflable: true }),
  bio("bio-inh", "Linkage", "Assertion: Linked genes do not show independent assortment. Reason: They lie on the same chromosome.", 1, "medium", "NCERT exemplar"),
  bio("bio-inh", "Test cross", "A test cross is performed between an organism of unknown genotype and one that is…", 1, "easy", "Sample paper 2022", { optionsShufflable: true }),
  bio("bio-inh", "Mendelian disorders", "Which of the following is an example of a Mendelian disorder?", 1, "easy", "Board 2020", { optionsShufflable: true }),
  bio("bio-inh", "Chromosomal disorders", "Down's syndrome results from trisomy of chromosome…", 1, "easy", "NCERT"),
  bio("bio-inh", "Pedigree analysis", "In a pedigree chart, a filled circle represents…", 1, "easy", "Sample paper 2021", { optionsShufflable: true }),
  bio("bio-mol", "DNA replication", "The enzyme that joins Okazaki fragments during replication is…", 1, "easy", "Sample paper 2022"),
  bio("bio-mol", "Transcription unit", "In a transcription unit, the promoter is located…", 1, "medium", "NCERT"),
  bio("bio-mol", "Genetic code", "The codon that acts as the initiation signal in eukaryotes is…", 1, "easy", "Board 2018", { optionsShufflable: true }),
  bio("bio-mol", "Packaging of DNA", "Histones are rich in which two basic amino acids?", 1, "medium", "NCERT"),
  bio("bio-mol", "Human Genome Project", "Approximately how many genes were estimated in the human genome?", 1, "medium", "Board 2019"),
  bio("bio-mol", "DNA fingerprinting", "DNA fingerprinting relies on polymorphism in…", 1, "medium", "Board 2021", { optionsShufflable: true }),
  bio("bio-evo", "Evidence of evolution", "Analogous organs are the result of…", 1, "easy", "NCERT", { optionsShufflable: true }),
  bio("bio-evo", "Hardy–Weinberg", "The Hardy–Weinberg principle states that allele frequencies in a population are…", 1, "medium", "Board 2020"),
  bio("bio-evo", "Adaptive radiation", "Darwin's finches on the Galapagos are a classic example of…", 1, "easy", "NCERT"),
  bio("bio-evo", "Human evolution", "Which hominid is regarded as the first to use tools?", 1, "medium", "Board 2018", { optionsShufflable: true }),
  bio("bio-hhd", "Pathogens", "The causative agent of typhoid is…", 1, "easy", "NCERT", { optionsShufflable: true }),
  bio("bio-hhd", "Immunity", "Antibodies belong to which class of biomolecules?", 1, "easy", "Sample paper 2020"),
  bio("bio-hhd", "AIDS", "HIV primarily infects which cells of the immune system?", 1, "medium", "Board 2022", { optionsShufflable: true }),
  bio("bio-hhd", "Cancer", "Contact inhibition is lost in which type of cell?", 1, "medium", "NCERT exemplar"),
  bio("bio-hhd", "Drug abuse", "Which of the following is a natural opioid?", 1, "easy", "Board 2019", { optionsShufflable: true }),
  bio("bio-btp", "Restriction enzymes", "EcoRI cuts DNA to leave which kind of end?", 1, "medium", "NCERT"),
  bio("bio-btp", "Vectors", "The ori site in a plasmid vector is responsible for…", 1, "medium", "Board 2021"),
  bio("bio-mol", "Genetic code", "A frameshift mutation is least likely to result from which of the following?", 1, "hard", "Board 2022"),
  bio("bio-inh", "Linkage", "Two genes 50 cM apart on the same chromosome will appear to…", 1, "hard", "NCERT exemplar"),
  bio("bio-evo", "Hardy–Weinberg", "If q = 0.3, the expected frequency of heterozygotes at equilibrium is…", 1, "hard", "Sample paper 2022"),
  bio("bio-hhd", "Immunity", "Which of the following would NOT follow from the loss of thymus at birth?", 1, "hard", "Board 2021"),

  // ---- 2 marks ----
  bio("bio-inh", "Pleiotropy", "Define pleiotropy. Give one example from humans and explain the underlying reason.", 2, "easy", "Institute set 3"),
  bio("bio-inh", "Incomplete dominance", "Differentiate between incomplete dominance and co-dominance with one example each.", 2, "medium", "Board 2020"),
  bio("bio-inh", "Multiple alleles", "Why is ABO blood grouping considered an example of multiple allelism?", 2, "medium", "NCERT"),
  bio("bio-mol", "Central dogma", "State the central dogma of molecular biology. Name one exception to it.", 2, "easy", "NCERT"),
  bio("bio-mol", "Semi-conservative replication", "How did Meselson and Stahl demonstrate semi-conservative replication?", 2, "medium", "Board 2019"),
  bio("bio-mol", "Splicing", "What is meant by RNA splicing? Why is it necessary in eukaryotes?", 2, "medium", "Sample paper 2022"),
  bio("bio-evo", "Homologous organs", "Differentiate between analogous and homologous organs with one example each.", 2, "medium", "Board 2020"),
  bio("bio-evo", "Natural selection", "Explain stabilising selection with the help of an example.", 2, "medium", "NCERT exemplar"),
  bio("bio-hhd", "Life cycle of Plasmodium", "Draw a flow chart of the stages of Plasmodium in the human host.", 2, "medium", "Board 2021"),
  bio("bio-hhd", "Vaccination", "Distinguish between active and passive immunity.", 2, "easy", "NCERT"),
  bio("bio-hhd", "Allergies", "What causes an allergic reaction? Name the antibodies involved.", 2, "easy", "Sample paper 2021"),
  bio("bio-btp", "PCR", "Name the three steps of a PCR cycle and state the purpose of each.", 2, "medium", "NCERT"),
  bio("bio-mol", "Packaging of DNA", "Explain why the nucleosome is described as the first level of DNA packaging, and calculate the packing ratio achieved.", 2, "hard", "Board 2022"),
  bio("bio-inh", "Chromosomal disorders", "Why does non-disjunction produce a viable trisomy for chromosome 21 but rarely for chromosome 1?", 2, "hard", "NCERT exemplar"),
  bio("bio-evo", "Genetic drift", "A population crashes from 10,000 to 50. Explain the two distinct effects on allele frequencies.", 2, "hard", "Sample paper 2022"),

  // ---- 3 marks ----
  bio("bio-inh", "Sex-linked inheritance", "A colour-blind man marries a woman with no family history of colour blindness. Work out the inheritance pattern up to F₂.", 3, "hard", "Board 2018"),
  bio("bio-inh", "Mendel's experiments", "Why did Mendel select the garden pea for his experiments? State four reasons.", 3, "easy", "NCERT"),
  bio("bio-inh", "Polygenic inheritance", "Explain polygenic inheritance using human skin colour as an example.", 3, "medium", "Board 2022"),
  bio("bio-mol", "DNA as genetic material", "Describe the Hershey and Chase experiment. What did it establish that Griffith's work could not?", 3, "medium", "NCERT"),
  bio("bio-mol", "Transcription in prokaryotes", "Describe the process of transcription in prokaryotes with reference to the role of sigma factor.", 3, "medium", "Board 2020"),
  bio("bio-mol", "Translation", "Explain the role of ribosomes and tRNA in the elongation phase of translation.", 3, "hard", "Sample paper 2022"),
  bio("bio-evo", "Industrial melanism", "Explain industrial melanism in Biston betularia as evidence for natural selection.", 3, "medium", "Board 2019"),
  bio("bio-evo", "Genetic drift", "Distinguish between the founder effect and the bottleneck effect with examples.", 3, "hard", "NCERT exemplar"),
  bio("bio-hhd", "Immune system", "Describe the structure of an antibody molecule with a labelled sketch.", 3, "medium", "Board 2021"),
  bio("bio-hhd", "Cancer detection", "Describe three techniques used in the detection of cancer.", 3, "easy", "NCERT"),

  // ---- 5 marks ----
  bio("bio-inh", "Incomplete dominance", "Explain incomplete dominance using the Mirabilis jalapa cross up to F₂. How does it differ from co-dominance?", 5, "medium", "Institute set 7"),
  bio("bio-mol", "Regulation of gene expression", "Explain the lac operon in the presence and absence of lactose. Draw a labelled diagram.", 5, "hard", "Board 2023"),
  bio("bio-mol", "DNA replication", "Describe the process of DNA replication in eukaryotes, naming the enzymes involved at each step.", 5, "medium", "Board 2020"),
  bio("bio-evo", "Origin of life", "Describe the experiment of Miller and Urey and explain what it demonstrated about the origin of life.", 5, "medium", "NCERT"),
  bio("bio-hhd", "AIDS", "Describe the replication cycle of HIV in the human host and explain why the infection is slow to manifest.", 5, "hard", "Board 2022"),
  bio("bio-hhd", "Immunity", "Compare humoral and cell-mediated immunity. Explain the role of B and T lymphocytes in each.", 5, "medium", "Sample paper 2021"),
  bio("bio-btp", "Recombinant DNA technology", "Describe the steps involved in producing a recombinant DNA molecule and its transfer into a host cell.", 5, "hard", "NCERT"),
  bio("bio-inh", "Chromosomal theory", "Explain the chromosomal theory of inheritance and describe the experiments that supported it.", 5, "medium", "Board 2019"),

  // ---- institute-private rows (Sunrise's own material) ----
  bio("bio-inh", "Dihybrid ratios", "From the institute's 2025 revision set: a dihybrid cross gives 1:1:1:1 in the test cross progeny. Interpret the result.", 2, "medium", "Sunrise set 11", { ownerInstituteId: SUNRISE_ID }),
  bio("bio-mol", "Splicing", "Sunrise mock 4: explain why alternative splicing increases proteome complexity without increasing gene number.", 3, "hard", "Sunrise mock 4", { ownerInstituteId: SUNRISE_ID }),
  bio("bio-evo", "Hardy–Weinberg", "Sunrise mock 2: in a population of 1000, 90 individuals show the recessive trait. Calculate allele frequencies.", 3, "medium", "Sunrise mock 2", { ownerInstituteId: SUNRISE_ID }),
];

// ---------------------------------------------------------------------------
// Class 10 Science — includes a case-study stimulus block
// ---------------------------------------------------------------------------
const CASE_BODY =
  "A strip of copper is dipped into silver nitrate solution. Over an hour the colourless " +
  "solution turns pale blue and a greyish-white deposit forms on the copper.";

export const SCIENCE_BANK: BankItem[] = [
  sci("sci-crx", "Types of reactions", "Which of the following is a displacement reaction?", 1, "easy", "Board 2020", { optionsShufflable: true }),
  sci("sci-crx", "Balancing equations", "The number of water molecules needed to balance Fe + H₂O → Fe₃O₄ + H₂ is…", 1, "medium", "NCERT"),
  sci("sci-crx", "Oxidation", "In ZnO + C → Zn + CO, the substance oxidised is…", 1, "medium", "Sample paper 2021", { optionsShufflable: true }),
  sci("sci-acd", "pH scale", "A solution turns blue litmus red. Its pH is most likely…", 1, "easy", "NCERT"),
  sci("sci-acd", "Neutralisation", "The salt formed when NaOH reacts with HCl is…", 1, "easy", "Board 2019", { optionsShufflable: true }),
  sci("sci-lgt", "Mirror formula", "An object is placed 20 cm from a concave mirror of focal length 15 cm. The image distance is…", 1, "medium", "Board 2021"),
  sci("sci-lgt", "Refractive index", "The refractive index of glass is 1.5. The speed of light in glass is…", 1, "medium", "NCERT"),
  sci("sci-lgt", "Power of a lens", "The power of a convex lens of focal length 50 cm is…", 1, "easy", "Sample paper 2022"),
  sci("sci-ele", "Resistance in parallel", "Three resistors of 2 Ω, 3 Ω and 6 Ω in parallel give an equivalent resistance of…", 1, "medium", "Board 2020", { optionsShufflable: true }),
  sci("sci-ele", "Electric power", "A bulb draws 0.5 A at 220 V. Its power is…", 1, "easy", "NCERT"),
  sci("sci-ele", "Ohm's law", "The SI unit of resistivity is…", 1, "easy", "Board 2018", { optionsShufflable: true }),
  sci("sci-lif", "Nutrition", "The opening and closing of stomata is controlled by…", 1, "easy", "NCERT", { optionsShufflable: true }),
  sci("sci-ele", "Heating effect", "Two lamps rated 60 W and 100 W at 220 V are joined in series. The brighter lamp is…", 1, "hard", "Board 2022"),
  sci("sci-lgt", "Refraction", "A ray enters a glass slab at 0° to the normal. The lateral shift is…", 1, "hard", "NCERT exemplar"),
  sci("sci-acd", "pH scale", "Equal volumes of pH 3 and pH 5 acids are mixed. The resulting pH is closest to…", 1, "hard", "Sample paper 2022"),

  sci("sci-crx", "Balancing equations", "Balance the equation Fe + H₂O → Fe₃O₄ + H₂ and identify the type of reaction.", 3, "medium", "Board 2019"),
  sci("sci-crx", "Corrosion", "What is rancidity? State two methods of preventing it.", 3, "easy", "NCERT"),
  sci("sci-acd", "Salts", "Explain what happens when washing soda is heated. Write the equation.", 3, "medium", "Board 2021"),
  sci("sci-lgt", "Lens formula", "A convex lens forms a real image at 30 cm when the object is at 20 cm. Find the focal length and magnification.", 3, "medium", "Sample paper 2022"),
  sci("sci-lgt", "Refraction", "State the laws of refraction and define absolute refractive index.", 3, "easy", "NCERT"),
  sci("sci-ele", "Series circuits", "Two resistors 4 Ω and 6 Ω are in series across a 12 V battery. Find the current and the p.d. across the 6 Ω resistor.", 3, "medium", "Board 2020"),
  sci("sci-ele", "Heating effect", "Derive an expression for the heat produced in a resistor carrying current I for time t.", 3, "hard", "Board 2022"),
  sci("sci-lif", "Respiration", "Differentiate between aerobic and anaerobic respiration with one example each.", 3, "easy", "NCERT"),

  sci("sci-crx", "Reactivity series", "Why does copper not displace zinc from zinc sulphate solution? Support your answer with the reactivity series.", 2, "medium", "NCERT"),
  sci("sci-acd", "Indicators", "Name two natural indicators and state the colour change each shows in a base.", 2, "easy", "Board 2019"),
  sci("sci-lgt", "Mirrors", "State two uses of a concave mirror with reasons.", 2, "easy", "NCERT"),
  sci("sci-ele", "Domestic circuits", "Why is the fuse connected in the live wire and not the neutral?", 2, "medium", "Board 2021"),
  sci("sci-lif", "Transport", "State two differences between arteries and veins.", 2, "easy", "NCERT"),
  sci("sci-crx", "Types of reactions", "Give one example each of a combination and a decomposition reaction, with equations.", 2, "easy", "Sample paper 2021"),
  sci("sci-ele", "Resistance in parallel", "Explain why adding a resistor in parallel always lowers the equivalent resistance below the smallest branch.", 2, "hard", "Board 2022"),
  sci("sci-lgt", "Power of a lens", "Two thin lenses of powers +5 D and −2 D are in contact. Find the focal length of the combination.", 2, "hard", "NCERT exemplar"),
  sci("sci-acd", "Salts", "Explain why an aqueous solution of sodium carbonate is basic although it is a salt.", 2, "hard", "Board 2021"),

  sci("sci-lgt", "Mirror formula", "Derive the mirror formula for a concave mirror using a ray diagram.", 5, "hard", "Board 2022"),
  sci("sci-ele", "Circuits", "Explain, with a circuit diagram, how you would verify Ohm's law in the laboratory.", 5, "medium", "NCERT"),
  sci("sci-crx", "Redox", "Explain oxidation and reduction with two examples each, identifying the oxidising and reducing agents.", 5, "medium", "Board 2020"),
  sci("sci-lif", "Life processes", "Describe the human digestive system with a labelled diagram.", 5, "medium", "NCERT"),

  // a case-study block: one stimulus, three questions, moves as one unit
  sci("sci-crx", "Displacement reactions", "Write the balanced equation for the reaction described and name its type.", 2, "medium", "Board 2023", {
    stimulusId: "case-cu-ag", stimulusBody: CASE_BODY, stimulusKind: "case_study",
  }),
  sci("sci-crx", "Displacement reactions", "Explain why the solution turns blue.", 1, "medium", "Board 2023", {
    stimulusId: "case-cu-ag", stimulusBody: CASE_BODY, stimulusKind: "case_study",
  }),
  sci("sci-crx", "Displacement reactions", "State one observation that confirms silver has been deposited.", 1, "medium", "Board 2023", {
    stimulusId: "case-cu-ag", stimulusBody: CASE_BODY, stimulusKind: "case_study",
  }),
];

export const ALL_BANK: BankItem[] = [...BIOLOGY_BANK, ...SCIENCE_BANK];

export function bankFor(classSubjectId: string): BankItem[] {
  return ALL_BANK.filter((b) => b.classSubjectId === classSubjectId);
}

export function chaptersFor(classSubjectId: string): DemoChapter[] {
  return CHAPTERS.filter((c) => c.classSubjectId === classSubjectId);
}

export function classSubject(id: string): DemoClassSubject | undefined {
  return CLASS_SUBJECTS.find((c) => c.id === id);
}

export function csLabel(id: string): string {
  const cs = classSubject(id);
  return cs ? `Class ${cs.className} · ${cs.subjectName}` : id;
}

/** Project bank items into the generator's input shape. */
export function toGenQuestions(items: BankItem[]): GenQuestion[] {
  return items.map((b, i) => ({
    id: b.id,
    ownerInstituteId: b.ownerInstituteId,
    classSubjectId: b.classSubjectId,
    chapterId: b.chapterId,
    // the generator spreads on topic; use the topic NAME as the key so two
    // questions on "Dihybrid ratios" are correctly treated as the same topic
    topicId: `${b.chapterId}:${b.topicName}`,
    strandId: null,
    stimulusId: b.stimulusId ?? null,
    parentQuestionId: null,
    withinBlockOrder: i,
    difficulty: b.difficulty,
    marks: b.marks,
    questionType: "mixed",
    optionsShufflable: b.optionsShufflable ?? false,
    positionLocked: b.positionLocked ?? false,
  }));
}

export const BANK_INDEX: Map<string, BankItem> = new Map(ALL_BANK.map((b) => [b.id, b]));
