import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // `next build` and `next dev` share .next by default, so building while a dev
  // server is running corrupts its webpack chunks and the running app dies with
  // "__webpack_modules__[moduleId] is not a function". Setting NEXT_DIST_DIR
  // gives a build its own directory. `npm run build:check` uses it — prefer that
  // for verification while a dev server is up. Vercel builds unset it and use .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  typescript: {
    // Do not let a type error slip into a production build.
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  // Baseline browser hardening on every response. No page is meant to be framed
  // by another site (clickjacking a "Delete paper" button), sniffed into another
  // type, or to leak its path (which can carry ids) to other origins.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
  experimental: {
    // Signed-in pages are dynamic, and by default (0) the browser throws them
    // away the moment you leave, so going back to a page you saw five seconds
    // ago waits on the server again. Keep them for 30 seconds. Anything that
    // changes data calls revalidatePath, which clears this at once, and
    // signing in or out reloads the whole page, so nobody sees another
    // account's cached page.
    staleTimes: { dynamic: 30 },
    // question figures are uploaded through a server action (2 MB images)
    serverActions: { bodySizeLimit: "3mb" },
  },
};

export default nextConfig;
