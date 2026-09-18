/**
 * What the service worker may cache, in one tested place (BUILD-PLAN C9
 * item 8). public/sw.js is generated from these constants by
 * src/app/sw.js/route.ts, so the worker and the tests cannot disagree.
 *
 *   - Only the student app's READ screens are kept for offline use: the test
 *     list, practice, weak spots, account. Logging (/app/log/...) is never
 *     cached — it needs a connection and must say so.
 *   - Pages are cached per user. A shared family phone must never show one
 *     child's tests to another: the cache name carries a hash of the user id,
 *     every other user's page cache is deleted when a user is announced, and
 *     sign-out deletes them all.
 *   - Hashed build assets under /_next/static are immutable and shared.
 */
export const PAGE_CACHE_PREFIX = "pf-pages-";
export const ASSET_CACHE = "pf-assets-v1";
export const META_CACHE = "pf-meta";
export const OFFLINE_PATH = "/offline";

/** Student read screens that may be served from cache when offline. */
export const OFFLINE_PAGES = ["/app", "/app/practice", "/app/weak", "/app/me"] as const;

export function pageCacheName(userHash: string): string {
  return `${PAGE_CACHE_PREFIX}${userHash}`;
}

/** Should a navigation to this path be cached (for the current user)? */
export function isOfflinePage(pathname: string): boolean {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return (OFFLINE_PAGES as readonly string[]).includes(p);
}

export function isImmutableAsset(pathname: string): boolean {
  return pathname.startsWith("/_next/static/");
}

/** Page caches to delete when `userHash` becomes the current user (null = signed out). */
export function cachesToDelete(existing: readonly string[], userHash: string | null): string[] {
  return existing.filter((name) => name.startsWith(PAGE_CACHE_PREFIX) && (userHash === null || name !== pageCacheName(userHash)));
}

/** A user id hashed for use in a cache name; never the raw id. */
export async function hashUserId(userId: string): Promise<string> {
  const bytes = new TextEncoder().encode(`paperflow-cache:${userId}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** The install prompt is offered from the second visit on (C9 item 8). */
export function shouldOfferInstall(visits: number, dismissed: boolean, standalone: boolean): boolean {
  return visits >= 2 && !dismissed && !standalone;
}
