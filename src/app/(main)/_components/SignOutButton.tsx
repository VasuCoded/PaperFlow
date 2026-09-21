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

/**
 * Signs out, then loads /login as a full page rather than a client-side
 * navigation, so nothing the previous person loaded stays in the tab.
 */
export function SignOutButton({
  className = "btn sm ghost",
  label = "Sign out",
  block = false,
}: {
  className?: string;
  label?: string;
  block?: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      style={block ? { display: "block", width: "100%" } : undefined}
      onClick={() =>
        start(async () => {
          await clearOfflinePages();
          await signOutAction();
          window.location.replace("/login");
        })
      }
    >
      {pending ? "Signing out…" : label}
    </button>
  );
}
