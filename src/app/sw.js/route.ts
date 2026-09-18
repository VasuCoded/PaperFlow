import { serviceWorkerSource } from "@/lib/pwa/service-worker";

// A new deployment gets a new worker (the version changes the bytes, which is
// what makes the browser install the update).
const VERSION = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "dev";

export function GET() {
  return new Response(serviceWorkerSource(VERSION), {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // Browsers re-check the worker at most daily anyway; never let a CDN
      // pin an old one.
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Service-Worker-Allowed": "/",
    },
  });
}
