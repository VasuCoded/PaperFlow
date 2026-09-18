/**
 * load-test.ts (BUILD-PLAN C12): "40 concurrent students across two
 * institutes loading the test list and logging an attempt. Report p95
 * latency. I want the real number, not the modelled one."
 *
 * Runs against a SEEDED STAGING project (npm run seed:staging), never
 * production: it writes attempts. Every student is a synthetic staging user;
 * their access tokens are minted with the staging project's JWT secret, and
 * each request goes to Supabase exactly as the student app's server code
 * sends it — the same queries, the same RPC, the same RLS.
 *
 *   SUPABASE_URL=https://<staging-ref>.supabase.co \
 *   SUPABASE_ANON_KEY=<staging anon key> \
 *   SUPABASE_JWT_SECRET=<staging JWT secret> \
 *   npm run load-test -- --i-know-this-is-staging [--students 40] [--rounds 3]
 *
 * What it measures: the database/API time of a test-list load (session
 * lookup + papers + the student's attempts, in parallel as the app does) and
 * of logging a paper (log_attempt). What it does not: Vercel function cold
 * starts and page rendering. For those, open /app on a phone over 4G with the
 * browser's network panel — the C9 budget is 2.5 s to interactive.
 */
import { createClient } from "@supabase/supabase-js";
import { mintAccessToken, summarise, wrongPositions } from "./load/load-lib";
import { instituteId, stagingPeople } from "./staging/staging-sql";

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? Number(process.argv[i + 1]) : NaN;
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

async function main() {
  if (!process.argv.includes("--i-know-this-is-staging")) {
    throw new Error("add --i-know-this-is-staging: this writes attempts, and must only run against the seeded staging project");
  }
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!url || !anon || !secret) throw new Error("set SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_JWT_SECRET (staging)");

  const studentsWanted = arg("students", 40);
  const rounds = arg("rounds", 3);
  const institutes = ["sunrise", "riverside"];
  const perInstitute = Math.ceil(studentsWanted / institutes.length);
  const students = institutes.flatMap((inst) =>
    stagingPeople(inst)
      .filter((p) => p.role === "student")
      .slice(0, perInstitute)
      .map((p) => ({ ...p, inst, instituteId: instituteId(inst) })),
  ).slice(0, studentsWanted);

  console.log(`load test: ${students.length} students across ${institutes.join(" + ")}, ${rounds} round(s) each, all concurrent`);

  const samples: { op: string; ms: number; ok: boolean }[] = [];
  const time = async <T>(op: string, fn: () => Promise<{ error: unknown } & T>) => {
    const t0 = performance.now();
    try {
      const r = await fn();
      samples.push({ op, ms: performance.now() - t0, ok: !r.error });
      return r;
    } catch {
      samples.push({ op, ms: performance.now() - t0, ok: false });
      return null;
    }
  };

  const wall0 = performance.now();
  await Promise.all(
    students.map(async (st, idx) => {
      const db = createClient(url, anon, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${mintAccessToken(st.id, st.email, secret)}` } },
      });

      for (let round = 0; round < rounds; round++) {
        // 1. The test list, as /app loads it: session lookup and the lists in parallel.
        let papers: { id: string }[] = [];
        await time("test list", async () => {
          const [members, profile, list, attempts] = await Promise.all([
            db.from("institute_members").select("institute_id, role, institutes(id, name, slug, kind, status)"),
            db.from("profiles").select("email, full_name").eq("id", st.id).maybeSingle(),
            db
              .from("papers")
              .select("id, title, class_subject_id, created_at, total_marks, paper_sets ( count )")
              .eq("institute_id", st.instituteId)
              .neq("status", "draft")
              .order("created_at", { ascending: false })
              .limit(120),
            db.from("attempts").select("paper_id, attempt_items ( is_correct )").eq("institute_id", st.instituteId).eq("student_id", st.id),
          ]);
          papers = list.data ?? [];
          return { error: members.error ?? profile.error ?? list.error ?? attempts.error };
        });

        // 2. Log a paper: choose the set, send the tapped positions.
        const paper = papers[(idx + round) % Math.max(1, papers.length)];
        if (!paper) continue;
        const sets = await db.from("paper_sets").select("id, set_label").eq("paper_id", paper.id).order("set_label");
        const set = sets.data?.[(idx + round) % Math.max(1, sets.data.length)];
        await time("log paper", async () =>
          await db.rpc("log_attempt", {
            p_paper_id: paper.id,
            p_paper_set_id: set?.id,
            p_wrong_positions: wrongPositions(16, idx * 31 + round),
          }),
        );
      }
    }),
  );
  const wallMs = performance.now() - wall0;

  const stats = summarise(samples);
  console.log("");
  console.log("operation     count  errors   p50 ms   p95 ms   max ms");
  for (const s of stats) {
    console.log(
      `${s.op.padEnd(12)} ${String(s.count).padStart(6)} ${String(s.errors).padStart(7)} ${String(s.p50).padStart(8)} ${String(s.p95).padStart(8)} ${String(s.max).padStart(8)}`,
    );
  }
  console.log(`\nwall time ${Math.round(wallMs)} ms`);
  if (stats.some((s) => s.errors > 0)) {
    console.log("errors > 0: check the project is seeded (npm run seed:staging) and the JWT secret is the staging one.");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
