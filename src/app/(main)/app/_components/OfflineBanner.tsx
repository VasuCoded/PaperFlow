"use client";

import { useEffect, useState } from "react";

/**
 * Logging needs a connection, and the app must say so plainly rather than
 * failing into an invisible queue the student never learns about (C9 item 8).
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;
  return (
    <div className="m-banner offline" role="status">
      <b>You&rsquo;re offline.</b> You can read your tests and practice, but logging a paper needs a
      connection — nothing will be saved until you are back online.
    </div>
  );
}
