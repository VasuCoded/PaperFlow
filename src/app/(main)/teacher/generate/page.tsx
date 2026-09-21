import "katex/dist/katex.min.css";
import type { Metadata } from "next";
import { AppShell } from "../../_components/AppShell";
import { getSession } from "@/server/session";
import {
  getBatches,
  getChapterCounts,
  getPatterns,
  getStrands,
  getTeachingSubjects,
} from "@/server/data/teacher";
import { defaultInstructions } from "@/lib/paper-layout";
import { GenerateClient, type SubjectBundle } from "./GenerateClient";

export const metadata: Metadata = { title: "Set a paper · PaperFlow" };

export default async function GeneratePage() {
  const session = await getSession();
  const subjects = session ? await getTeachingSubjects(session) : [];
  const instituteId = session?.instituteId ?? "";

  // A teacher has a handful of class-subjects, so load each one's chapters,
  // patterns and batches up front: one aggregate per class-subject (C8), and
  // switching subject in the form costs no round trip.
  const bundles: SubjectBundle[] = await Promise.all(
    subjects.map(async (s) => {
      const [chapters, patterns, batches, strands] = await Promise.all([
        getChapterCounts(instituteId, s.classSubjectId),
        getPatterns(instituteId, s.classSubjectId),
        getBatches(instituteId, s.classSubjectId),
        getStrands(s.classSubjectId),
      ]);
      return {
        classSubjectId: s.classSubjectId,
        label: `Class ${s.className} · ${s.subjectName}`,
        chapters,
        patterns: patterns.map((p) => ({
          id: p.id,
          name: p.name,
          totalMarks: p.totalMarks,
          durationMin: p.durationMin,
          origin: p.origin,
          /** an institute template (not a platform / board pattern) */
          isInstituteTemplate: p.ownerInstituteId === instituteId,
          // whoever saved a template, or an institute admin, may take it off the list
          canRemove:
            p.ownerInstituteId === instituteId &&
            (p.createdBy === session?.userId || session?.role === "institute_admin"),
          generalInstructions: p.generalInstructions ?? "",
          sections: p.sections.map((sec, i) => ({
            questionTypes: sec.questionTypes,
            requiresStimulus: sec.requiresStimulus,
            questionCount: sec.questionCount,
            marksEach: sec.marksEach,
            allowChoice: sec.allowChoice,
            practiceEligible: sec.practiceEligible,
            instructions: p.sectionInstructions[i] ?? defaultInstructions(sec),
          })),
        })),
        batches,
        strands,
      };
    }),
  );

  return (
    <AppShell
      area="teacher"
      pathname="/teacher/generate"
      split={bundles.length > 0}
    >
      {bundles.length === 0 ? (
        <div>
          <h2 className="sect">Nothing to set yet</h2>
          <p className="lede">
            No class and subject is assigned to you at this institute, or none of your subjects has
            been activated yet.
          </p>
          <div className="notice plain">
            Your institute admin assigns subjects under <b>Teacher subjects</b>. A subject only
            appears once the platform has activated it for your institute — that is deliberate, so
            you never get a dropdown full of subjects with too few questions to build a paper from.
          </div>
        </div>
      ) : (
        <GenerateClient subjects={bundles} />
      )}
    </AppShell>
  );
}
