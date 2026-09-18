import { ImageResponse } from "next/og";
import { AppIcon } from "@/lib/pwa/icon";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<AppIcon px={64} />, size);
}
