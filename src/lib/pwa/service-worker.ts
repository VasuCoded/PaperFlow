import { ASSET_CACHE, META_CACHE, OFFLINE_PAGES, OFFLINE_PATH, PAGE_CACHE_PREFIX } from "./policy";

/**
 * The service worker's source, with the policy constants inlined. Served at
 * /sw.js by src/app/sw.js/route.ts. Plain JavaScript on purpose: it runs in
 * the browser's worker context, not through the Next build.
 *
 * Strategy
 *   navigation to an offline page  network first; on success store under the
 *                                   current user's cache; offline → that
 *                                   user's cached copy → /offline
 *   navigation to anything else     network; offline → /offline
 *   /_next/static/*                 cache first (hashed, immutable)
 *   everything else                 untouched — server actions (POST) and API
 *                                   calls always go to the network
 *
 * With no user announced (signed out, or before the app has said who is
 * signed in) nothing is cached or served from the page cache.
 */
export function serviceWorkerSource(version: string): string {
  return `/* PaperFlow service worker ${version} — generated; see src/lib/pwa/service-worker.ts */
"use strict";
const PAGE_CACHE_PREFIX = ${JSON.stringify(PAGE_CACHE_PREFIX)};
const ASSET_CACHE = ${JSON.stringify(ASSET_CACHE)};
const META_CACHE = ${JSON.stringify(META_CACHE)};
const OFFLINE_PATH = ${JSON.stringify(OFFLINE_PATH)};
const OFFLINE_PAGES = ${JSON.stringify(OFFLINE_PAGES)};
const USER_KEY = "/__pf/current-user";

function isOfflinePage(pathname) {
  const p = pathname.length > 1 ? pathname.replace(/\\/+$/, "") : pathname;
  return OFFLINE_PAGES.includes(p);
}

async function currentUser() {
  const meta = await caches.open(META_CACHE);
  const hit = await meta.match(USER_KEY);
  return hit ? (await hit.text()) || null : null;
}

async function setCurrentUser(hash) {
  const meta = await caches.open(META_CACHE);
  if (hash) await meta.put(USER_KEY, new Response(hash));
  else await meta.delete(USER_KEY);
  // Drop every other user's pages: a shared phone must never show one
  // student's tests to the next person who signs in.
  const names = await caches.keys();
  await Promise.all(
    names
      .filter((n) => n.startsWith(PAGE_CACHE_PREFIX) && (!hash || n !== PAGE_CACHE_PREFIX + hash))
      .map((n) => caches.delete(n)),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(ASSET_CACHE)
      .then((c) => c.add(new Request(new URL(OFFLINE_PATH, self.location.origin).href, { cache: "reload" })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n.startsWith("pf-assets-") && n !== ASSET_CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "user") event.waitUntil(setCurrentUser(typeof data.hash === "string" ? data.hash : null));
  if (data.type === "signout") event.waitUntil(setCurrentUser(null));
});

async function offlineFallback() {
  const assets = await caches.open(ASSET_CACHE);
  return (await assets.match(OFFLINE_PATH)) || new Response("You are offline.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

async function handleNavigation(request, url) {
  const cacheable = isOfflinePage(url.pathname);
  const user = cacheable ? await currentUser() : null;
  try {
    const response = await fetch(request);
    // Only a real page for this user: not a redirect to sign-in, not an error,
    // not an opaque response.
    if (cacheable && user && response.ok && !response.redirected && !response.type.startsWith("opaque")) {
      const pages = await caches.open(PAGE_CACHE_PREFIX + user);
      await pages.put(url.pathname, response.clone());
    }
    return response;
  } catch (err) {
    if (cacheable && user) {
      const pages = await caches.open(PAGE_CACHE_PREFIX + user);
      const hit = await pages.match(url.pathname);
      if (hit) return hit;
    }
    return offlineFallback();
  }
}

async function handleAsset(request) {
  const assets = await caches.open(ASSET_CACHE);
  const hit = await assets.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) await assets.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request, url));
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(handleAsset(request));
  }
});
`;
}
