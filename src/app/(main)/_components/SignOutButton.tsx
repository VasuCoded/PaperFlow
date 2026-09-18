"use client";

import { useTransition } from "react";
import { signOutAction } from "@/server/actions/membership";
import { PAGE_CACHE_PREFIX } from "@/lib/pwa/policy";

/**
 * Forget this user's offline pages before signing out, so the next person on
 * a shared phone never sees them (C9 item 8). The worker also drops them.
 */
async function clearOfflinePages() {
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: "signout" });
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith(PAGE_CACHE_PREFIX)).map((n) => caches.delete(n)));
    }
  } catch {
    // nothing cached, or storage unavailable
  }
}

export function SignOutButton({ className = "btn sm ghost" }: { className?: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      onClick={() => start(async () => { await clearOfflinePages(); await signOutAction(); })}
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
