import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { mintAccessToken, percentile, summarise, wrongPositions } from "../../scripts/load/load-lib";

describe("load test helpers", () => {
  it("mints an HS256 token PostgREST accepts as an authenticated user", () => {
    const token = mintAccessToken("user-1", "s@staging.test", "secret", 60, 1_000);
    const [h, p, sig] = token.split(".");
    const decode = (s: string) => JSON.parse(Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
    expect(decode(h!)).toEqual({ alg: "HS256", typ: "JWT" });
    expect(decode(p!)).toMatchObject({ sub: "user-1", role: "authenticated", aud: "authenticated", iat: 1_000, exp: 1_060 });
    const expected = createHmac("sha256", "secret").update(`${h}.${p}`).digest("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
    expect(sig).toBe(expected);
  });

  it("computes nearest-rank percentiles", () => {
    const xs = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(xs, 50)).toBe(50);
    expect(percentile(xs, 95)).toBe(95);
    expect(percentile([7], 95)).toBe(7);
    expect(percentile([], 95)).toBeNaN();
  });

  it("summarises per operation, excluding failed requests from latency", () => {
    const s = summarise([
      { op: "a", ms: 10, ok: true },
      { op: "a", ms: 30, ok: true },
      { op: "a", ms: 999, ok: false },
      { op: "b", ms: 5, ok: true },
    ]);
    expect(s).toEqual([
      { op: "a", count: 3, errors: 1, p50: 10, p95: 30, max: 30 },
      { op: "b", count: 1, errors: 0, p50: 5, p95: 5, max: 5 },
    ]);
  });

  it("picks a deterministic ~30% of positions as wrong", () => {
    expect(wrongPositions(16, 7)).toEqual(wrongPositions(16, 7));
    const total = Array.from({ length: 200 }, (_, i) => wrongPositions(16, i).length).reduce((a, b) => a + b, 0);
    expect(total / (200 * 16)).toBeGreaterThan(0.15);
    expect(total / (200 * 16)).toBeLessThan(0.45);
  });
});
