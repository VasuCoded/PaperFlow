import { Newsreader, Inter, JetBrains_Mono, Noto_Sans_Devanagari } from "next/font/google";

/**
 * Self-hosted at build time (C0 item 11) — print and first paint must never
 * wait on a CDN. Devanagari is a separate family so the Latin-only paths do not
 * pay for it; load it only where a Devanagari subject is rendered.
 */
export const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600"],
  variable: "--font-newsreader",
  display: "swap",
});

export const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const deva = Noto_Sans_Devanagari({
  subsets: ["devanagari", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-deva",
  display: "swap",
});

export const uiFontClass = `${newsreader.variable} ${inter.variable} ${jetbrains.variable}`;
