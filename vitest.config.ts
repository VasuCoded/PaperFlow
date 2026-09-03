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
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
