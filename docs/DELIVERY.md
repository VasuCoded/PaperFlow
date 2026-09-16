# Delivery: website first, native shell later

**Decision (16 Sep 2026).** PaperFlow ships as a **website** — every role, login
included — hosted on Vercel. If a native app is wanted later, it will be a
[Capacitor](https://capacitorjs.com) shell around the same web app rather than a
rewrite. No app store on day one.

This is already what the build plan assumes: C9 specifies the student app as an
installable PWA ("installable from Chrome on Android, prompt after the second
visit"), which is a website, not a store build. Nothing needs re-architecting.

---

## What web-first means for the build

- **Auth** is Supabase Auth + Google OAuth over a normal browser redirect. Works
  everywhere, nothing platform-specific.
- **The institute is resolved server-side on every request** (CLAUDE.md), which
  is only possible because we render on a server. Keep it that way — it is the
  control that stops a client from choosing its own tenant.
- **C9 still builds the PWA**: manifest, icons, service worker caching the app
  shell, test list and loaded practice readable offline. Key the cache by user
  and clear it on sign-out — a shared family phone must not leak one
  student's data to the next.

## Performance, since "smooth" is the bar

The plan sets a hard budget: **test list interactive in under 2.5 s on a
mid-range Android over 4G**, and Devanagari font loading must not block first
paint. Measure it on a real phone, not on a laptop.

The things that actually decide whether it feels smooth:

1. **Region.** Supabase in Mumbai (`ap-south-1`), Vercel functions in `bom1`.
   See the warning in `SETUP.md` §B — the Supabase region is fixed at creation.
   This dominates everything else; no amount of query tuning recovers a
   trans-Pacific round trip per request.
2. **Query shape, not query count.** C8 is explicit: chapter coverage counts must
   be *one aggregate query per class-subject, cached for the session*, never a
   query per chapter. With 26 class-subjects and a two-owner pool the naive
   version is visibly slow.
3. **Fonts.** Load only what a screen needs. The student path should not pull
   four families; Devanagari loads only for Devanagari subjects.
4. **Free-tier pausing.** Supabase free projects pause after ~7 idle days, which
   over a term break looks exactly like "the site is broken". The keep-alive
   workflow already handles this.

## If and when Capacitor happens

Two options, and they are not equally cheap:

**A. Remote URL shell (recommended).** Capacitor's `server.url` points at the
Vercel deployment. One codebase, SSR intact, updates ship instantly without a
store review. You gain the store listing and native niceties; you do not gain
real offline, which the PWA service worker covers anyway.

**B. Bundled static build.** Requires a static export, which this app cannot do
as designed — server-side institute resolution and the solution gate are
server-rendered on purpose. Going this route means rebuilding the data layer
client-side and re-solving tenancy in the client, which is precisely the bug
class the schema was built to prevent. **Do not pick B casually.**

### The landmine to know about now

**Google OAuth does not work in a plain webview.** Google blocks OAuth in
embedded webviews (`disallowed_useragent`), so `signInWithOAuth` inside a
Capacitor webview will fail. The fix is known but it is work, not a flag:

- use a native Google Sign-In plugin, or an in-app browser tab
  (Chrome Custom Tabs / `ASWebAuthenticationSession`) rather than the webview,
- register a custom URL scheme / deep link and add it to the Google OAuth
  client's authorised redirect URIs and to Supabase's redirect allow-list,
- exchange the returned code for a Supabase session in the app.

None of this changes anything today — the browser flow is correct and simplest.
It is written down so the Capacitor step is costed honestly rather than
discovered halfway through.

### Things to avoid now so B stays possible

Cheap habits that keep the native door open without costing anything today:

- No hard dependency on request headers or cookies that a shell cannot set.
- Keep the app usable at 390 px wide — the phone frame the student screens are
  designed against.
- Tap targets sized for a thumb, not a mouse.
- Never assume a persistent connection; say so plainly when an action needs one
  (C9 already requires this for logging).
