import type { Metadata } from "next";
import { Inter, Source_Serif_4, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";

// Fonts are downloaded at build time and served from our own origin.
// Print must never depend on a runtime CDN fetch (BUILD-PLAN C0 item 11).
const latinSans = Inter({
  subsets: ["latin"],
  variable: "--font-latin-sans",
  display: "swap",
});

const latinSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-latin-serif",
  display: "swap",
});

const deva = Noto_Sans_Devanagari({
  subsets: ["devanagari", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-deva",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PaperFlow",
  description: "Question bank and mistake-practice platform for classes 9-12.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${latinSans.variable} ${latinSerif.variable} ${deva.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
