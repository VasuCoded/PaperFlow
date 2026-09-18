/**
 * Pure helpers for scripts/load-test.ts: token minting and latency statistics.
 */
import { createHmac } from "node:crypto";

const b64url = (buf: Buffer | string) =>
  Buffer.from(buf).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

/**
 * An HS256 access token for a STAGING synthetic user, signed with the staging
 * project's JWT secret (Supabase → Project Settings → API → JWT secret).
 * Synthetic users cannot sign in with Google, so the load test speaks for them
 * the way PostgREST sees any signed-in user: role `authenticated`, sub = id.
 * Short-lived on purpose.
 */
export function mintAccessToken(userId: string, email: string, secret: string, ttlSeconds = 900, now = Math.floor(Date.now() / 1000)): string {
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    sub: userId,
    email,
    role: "authenticated",
    aud: "authenticated",
    iat: now,
    exp: now + ttlSeconds,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const sig = b64url(createHmac("sha256", secret).update(unsigned).digest());
  return `${unsigned}.${sig}`;
}

/** Nearest-rank percentile (p in 0..100) of a list of numbers. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))]!;
}

export interface OpStats {
  op: string;
  count: number;
  errors: number;
  p50: number;
  p95: number;
  max: number;
}

export function summarise(samples: { op: string; ms: number; ok: boolean }[]): OpStats[] {
  const ops = [...new Set(samples.map((s) => s.op))];
  return ops.map((op) => {
    const mine = samples.filter((s) => s.op === op);
    const ok = mine.filter((s) => s.ok).map((s) => s.ms);
    return {
      op,
      count: mine.length,
      errors: mine.length - ok.length,
      p50: Math.round(percentile(ok, 50)),
      p95: Math.round(percentile(ok, 95)),
      max: Math.round(ok.length ? Math.max(...ok) : NaN),
    };
  });
}

/** A deterministic subset of positions a student "got wrong" (~30%). */
export function wrongPositions(positions: number, seed: number): number[] {
  const out: number[] = [];
  let x = seed >>> 0 || 1;
  for (let i = 0; i < positions; i++) {
    x = (x * 1103515245 + 12345) >>> 0;
    if (x % 10 < 3) out.push(i);
  }
  return out;
}
