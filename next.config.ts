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
};

export default nextConfig;
