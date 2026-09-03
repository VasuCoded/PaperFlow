import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-latin-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-latin-serif)", "Georgia", "serif"],
        deva: ["var(--font-deva)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
