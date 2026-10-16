import { Newsreader, Inter, JetBrains_Mono, Noto_Sans_Devanagari, Source_Serif_4 } from "next/font/google";

/**
 * Every typeface the app uses, declared once. next/font self-hosts them at
 * build time (C0 item 11): print and first paint never wait on a CDN.
 *
 * Declaring the same family twice ships it twice, so the root layout, the app
 * and the demo all take their fonts from here.
 *
 * Preloading: the UI faces (Inter, Newsreader, JetBrains Mono) are on every
 * screen, so they preload. Devanagari and the print serif are only needed on
 * Hindi content and printed papers; preloading them would make every page
 * download them, so they load on demand when text first uses them.
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
  preload: false,
});

/** The printed paper's body face (globals.css, .pf-paper). */
export const printSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-latin-serif",
  display: "swap",
  preload: false,
});

/** On <body>: available everywhere, including print and offline pages. */
export const rootFontClass = `${inter.variable} ${printSerif.variable} ${deva.variable}`;

/** The app and demo's design system faces (paperflow.css reads these variables). */
export const uiFontClass = `${newsreader.variable} ${inter.variable} ${jetbrains.variable}`;
