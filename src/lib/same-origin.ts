/**
 * Cross-site request check for route handlers, which (unlike server actions)
 * get no Origin check from Next.
 *
 * A missing Origin is allowed: browsers always send one on a cross-site POST,
 * so its absence means a same-site navigation or a non-browser client, neither
 * of which is a forgery. A malformed Origin, or the literal "null" a sandboxed
 * frame sends, is refused.
 */
export function isSameOrigin(origin: string | null, host: string | null): boolean {
  if (origin === null) return true;
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
