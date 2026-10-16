/**
 * The real type of an uploaded image, read from its first bytes. The browser's
 * declared MIME type is whatever the client says, so a figure is accepted only
 * when its signature agrees with it.
 */
export type ImageKind = "png" | "jpg" | "webp";

export function sniffImage(head: Uint8Array): ImageKind | null {
  const at = (i: number, bytes: number[]) => bytes.every((b, k) => head[i + k] === b);
  if (at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (at(0, [0xff, 0xd8, 0xff])) return "jpg";
  // RIFF....WEBP
  if (at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50])) return "webp";
  return null;
}
