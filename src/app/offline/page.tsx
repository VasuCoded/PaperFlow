import "@/styles/paperflow.css";
import type { Metadata } from "next";
import { uiFontClass } from "@/lib/fonts";

export const metadata: Metadata = { title: "Offline · PaperFlow" };

/**
 * Served by the service worker when a page is not available offline. Static,
 * with no user data, so it is safe to cache for everyone.
 */
export default function OfflinePage() {
  return (
    <div className={`pf-ui ${uiFontClass}`} style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <p className="eyebrow">PaperFlow · offline</p>
        <h1 style={{ fontFamily: "var(--serif)", fontSize: 28, margin: "8px 0 12px" }}>You&rsquo;re offline</h1>
        <p style={{ color: "var(--graphite)", lineHeight: 1.5 }}>
          Your test list, practice and weak spots open offline once you have visited them on this phone. Logging a
          paper needs a connection — nothing is saved until you are back online.
        </p>
        <p style={{ marginTop: 18 }}>
          <a className="btn solid" href="/app">Try again</a>
        </p>
      </div>
    </div>
  );
}
