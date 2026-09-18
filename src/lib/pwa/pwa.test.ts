import { describe, expect, it } from "vitest";
import vm from "node:vm";
import {
  cachesToDelete,
  hashUserId,
  isImmutableAsset,
  isOfflinePage,
  pageCacheName,
  shouldOfferInstall,
  OFFLINE_PATH,
} from "./policy";
import { serviceWorkerSource } from "./service-worker";

describe("offline policy", () => {
  it("keeps the student read screens and nothing else", () => {
    for (const p of ["/app", "/app/", "/app/practice", "/app/weak", "/app/me"]) expect(isOfflinePage(p), p).toBe(true);
    for (const p of ["/app/log/123", "/teacher/generate", "/platform", "/login", "/welcome", "/institute/export"]) {
      expect(isOfflinePage(p), p).toBe(false);
    }
    expect(isImmutableAsset("/_next/static/chunks/a.js")).toBe(true);
    expect(isImmutableAsset("/app")).toBe(false);
  });

  it("drops every other user's pages when a user is announced, and all of them on sign-out", () => {
    const existing = [pageCacheName("aaa"), pageCacheName("bbb"), "pf-assets-v1", "pf-meta"];
    expect(cachesToDelete(existing, "aaa")).toEqual([pageCacheName("bbb")]);
    expect(cachesToDelete(existing, null)).toEqual([pageCacheName("aaa"), pageCacheName("bbb")]);
  });

  it("names caches by a hash, never the raw user id", async () => {
    const a = await hashUserId("3f1c9a2e-0000-0000-0000-000000000001");
    expect(a).toMatch(/^[0-9a-f]{24}$/);
    expect(await hashUserId("3f1c9a2e-0000-0000-0000-000000000001")).toBe(a);
    expect(await hashUserId("3f1c9a2e-0000-0000-0000-000000000002")).not.toBe(a);
    expect(a).not.toContain("3f1c9a2e");
  });

  it("offers install from the second visit, unless dismissed or already installed", () => {
    expect(shouldOfferInstall(1, false, false)).toBe(false);
    expect(shouldOfferInstall(2, false, false)).toBe(true);
    expect(shouldOfferInstall(5, true, false)).toBe(false);
    expect(shouldOfferInstall(5, false, true)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The generated worker, executed against a fake Cache Storage and network.
// ---------------------------------------------------------------------------

const ORIGIN = "https://paperflow.example";

class FakeCache {
  entries = new Map<string, Response>();
  constructor(private readonly net: (url: string) => Promise<Response>) {}
  private key(r: string | { url: string }) {
    return new URL(typeof r === "string" ? r : r.url, ORIGIN).pathname;
  }
  async match(r: string | { url: string }) {
    return this.entries.get(this.key(r))?.clone();
  }
  async put(r: string | { url: string }, res: Response) {
    this.entries.set(this.key(r), res);
  }
  async delete(r: string | { url: string }) {
    return this.entries.delete(this.key(r));
  }
  async add(r: string | { url: string }) {
    this.entries.set(this.key(r), await this.net(new URL(typeof r === "string" ? r : r.url, ORIGIN).pathname));
  }
}

function harness() {
  let online = true;
  const pages: Record<string, (user: string) => string> = {
    "/app": (u) => `tests for ${u}`,
    "/app/practice": (u) => `practice for ${u}`,
    "/app/log/p1": (u) => `logging for ${u}`,
    [OFFLINE_PATH]: () => "offline page",
  };
  let signedIn = "alice";
  const net = async (path: string) => {
    if (!online) throw new TypeError("Failed to fetch");
    const page = pages[path];
    return page ? new Response(page(signedIn), { status: 200 }) : new Response("nope", { status: 404 });
  };

  const stores = new Map<string, FakeCache>();
  const caches = {
    async open(name: string) {
      if (!stores.has(name)) stores.set(name, new FakeCache(net));
      return stores.get(name)!;
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(name: string) {
      return stores.delete(name);
    },
  };

  const listeners: Record<string, ((e: unknown) => void)[]> = {};
  const self = {
    location: new URL(ORIGIN),
    addEventListener: (type: string, fn: (e: unknown) => void) => (listeners[type] ??= []).push(fn),
    skipWaiting: async () => undefined,
    clients: { claim: async () => undefined },
  };
  vm.runInNewContext(serviceWorkerSource("test"), {
    self,
    caches,
    fetch: (req: { url: string }) => net(new URL(req.url).pathname),
    Response,
    Request,
    URL,
    Promise,
    console,
  });

  async function dispatch(type: string, extra: Record<string, unknown>) {
    const waits: Promise<unknown>[] = [];
    let response: Promise<Response> | undefined;
    const event = {
      ...extra,
      waitUntil: (p: Promise<unknown>) => waits.push(p),
      respondWith: (p: Promise<Response>) => (response = p),
    };
    for (const fn of listeners[type] ?? []) fn(event);
    await Promise.all(waits);
    return response;
  }

  return {
    stores,
    setOnline: (v: boolean) => (online = v),
    signIn: (user: string) => (signedIn = user),
    install: () => dispatch("install", {}),
    announce: (hash: string | null) => dispatch("message", { data: hash ? { type: "user", hash } : { type: "signout" } }),
    async navigate(path: string) {
      const res = await dispatch("fetch", { request: { url: ORIGIN + path, method: "GET", mode: "navigate" } });
      return res ? (await res).text() : "(not handled)";
    },
    async post(path: string) {
      return dispatch("fetch", { request: { url: ORIGIN + path, method: "POST", mode: "cors" } });
    },
  };
}

describe("the generated service worker", () => {
  it("parses as JavaScript", () => {
    expect(() => new vm.Script(serviceWorkerSource("x"))).not.toThrow();
  });

  it("serves a user's own tests offline", async () => {
    const sw = harness();
    await sw.install();
    await sw.announce("alice");
    expect(await sw.navigate("/app")).toBe("tests for alice");
    sw.setOnline(false);
    expect(await sw.navigate("/app")).toBe("tests for alice");
  });

  it("never serves one user's cached pages to the next person on a shared phone", async () => {
    const sw = harness();
    await sw.install();
    await sw.announce("alice");
    await sw.navigate("/app");
    await sw.navigate("/app/practice");

    // Bob signs in on the same phone; the app announces him.
    sw.signIn("bob");
    await sw.announce("bob");
    expect([...sw.stores.keys()].filter((k) => k.includes("alice"))).toEqual([]);
    sw.setOnline(false);
    expect(await sw.navigate("/app")).toBe("offline page");
  });

  it("forgets everything on sign-out, and caches nothing with no user announced", async () => {
    const sw = harness();
    await sw.install();
    await sw.announce("alice");
    await sw.navigate("/app");
    await sw.announce(null);
    sw.setOnline(false);
    expect(await sw.navigate("/app")).toBe("offline page");
    sw.setOnline(true);
    await sw.navigate("/app");
    expect([...sw.stores.keys()].filter((k) => k.startsWith("pf-pages-"))).toEqual([]);
  });

  it("never caches the logging screen, and leaves POSTs (server actions) alone", async () => {
    const sw = harness();
    await sw.install();
    await sw.announce("alice");
    await sw.navigate("/app/log/p1");
    sw.setOnline(false);
    expect(await sw.navigate("/app/log/p1")).toBe("offline page");
    expect(await sw.post("/app/log/p1")).toBeUndefined();
  });
});
