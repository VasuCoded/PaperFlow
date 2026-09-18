"use client";

import { useEffect, useState } from "react";
import { shouldOfferInstall } from "@/lib/pwa/policy";

const VISITS_KEY = "pf_visits";
const DISMISSED_KEY = "pf_install_dismissed";
const COUNTED_KEY = "pf_visit_counted";

/** Minimal type for the (Chromium-only) install prompt event. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function readNumber(key: string): number {
  try {
    return Number(localStorage.getItem(key) ?? "0") || 0;
  } catch {
    return 0;
  }
}

/**
 * Registers the service worker and tells it who is signed in, so pages are
 * cached under this user only (and any other user's cached pages on this
 * device are dropped). Counts visits for the install prompt.
 */
export function PwaRegistrar({ userHash }: { userHash: string }) {
  useEffect(() => {
    try {
      if (!sessionStorage.getItem(COUNTED_KEY)) {
        sessionStorage.setItem(COUNTED_KEY, "1");
        localStorage.setItem(VISITS_KEY, String(readNumber(VISITS_KEY) + 1));
      }
    } catch {
      // storage blocked (private mode): the prompt just never appears
    }

    if (!("serviceWorker" in navigator)) return;
    let cancelled = false;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        if (!cancelled) reg.active?.postMessage({ type: "user", hash: userHash });
      })
      .catch(() => {
        // No worker means no offline copy; the app itself still works.
      });
    return () => {
      cancelled = true;
    };
  }, [userHash]);

  return null;
}

/**
 * "Install PaperFlow" from the second visit on (C9 item 8). Chrome on Android
 * gives us a real prompt; iOS Safari has none, so it gets the Share-menu hint.
 */
export function InstallPrompt() {
  const [event, setEvent] = useState<InstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      dismissed = true;
    }
    const offer = shouldOfferInstall(readNumber(VISITS_KEY), dismissed, standalone);

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
    if (offer && isIos) {
      setIos(true);
      setShow(true);
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallPromptEvent);
      if (offer) setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!show || (!event && !ios)) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // ignore
    }
    setShow(false);
  };

  return (
    <div className="m-banner" role="status" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ flex: "1 1 200px" }}>
        {ios ? (
          <>Add PaperFlow to your home screen: tap <b>Share</b>, then <b>Add to Home Screen</b>. Your tests open even offline.</>
        ) : (
          <>Install PaperFlow on this phone — it opens like an app, and your tests and practice work offline.</>
        )}
      </span>
      {!ios && event && (
        <button
          type="button"
          className="btn sm solid"
          onClick={async () => {
            await event.prompt();
            await event.userChoice.catch(() => undefined);
            setEvent(null);
            setShow(false);
          }}
        >
          Install
        </button>
      )}
      <button type="button" className="btn sm ghost" onClick={dismiss}>
        Not now
      </button>
    </div>
  );
}
