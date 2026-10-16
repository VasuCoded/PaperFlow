import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // tsconfig sets jsx: "preserve" for Next, which leaves esbuild on the classic
  // runtime and makes .tsx components fail with "React is not defined" under
  // test. The automatic runtime matches how Next actually compiles them.
  esbuild: { jsx: "automatic" },
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    environment: "node",
    // Each DB suite boots its own PGlite and replays every migration. Alone that
    // takes ~2s; with every suite booting at once it can pass the default 10s
    // hook timeout, which failed whole suites for no real reason.
    hookTimeout: 120_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
