import { ImageResponse } from "next/og";
import { AppIcon } from "@/lib/pwa/icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  // iOS applies its own rounded mask, so draw full-bleed.
  return new ImageResponse(<AppIcon px={180} maskable />, size);
}
