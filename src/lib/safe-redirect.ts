/**
 * Where to send someone after sign-in, from an untrusted `?next=` value.
 *
 * Only a same-site path survives. Browsers treat a backslash like a forward
 * slash in http(s) URLs, so "/\evil.example" would otherwise become the
 * protocol-relative "//evil.example" and leave the site. Control characters
 * (tab, newline) are stripped by URL parsers and can hide the same trick.
 *
 * Pure — safe in client and server code.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || next[0] !== "/") return fallback;
  if (next.startsWith("//") || next.includes("\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(next)) return fallback;
  return next;
}
