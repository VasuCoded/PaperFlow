import { ImageResponse } from "next/og";
import { AppIcon } from "@/lib/pwa/icon";

// Rendered once at build time: /pwa/icon/192, /pwa/icon/512, /pwa/icon/maskable.
export const dynamic = "force-static";

const SIZES: Record<string, { px: number; maskable: boolean }> = {
  "192": { px: 192, maskable: false },
  "512": { px: 512, maskable: false },
  maskable: { px: 512, maskable: true },
};

export function generateStaticParams() {
  return Object.keys(SIZES).map((size) => ({ size }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const spec = SIZES[(await params).size];
  if (!spec) return new Response("Not found", { status: 404 });
  return new ImageResponse(<AppIcon px={spec.px} maskable={spec.maskable} />, { width: spec.px, height: spec.px });
}
