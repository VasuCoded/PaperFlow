import { createServerSupabaseClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";

// Reads the viewer's session on every request.
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };

/**
 * A question's figure. The asset row is read with the VIEWER's client first, so
 * RLS (question_assets_read) decides whether they may see it: shared-bank
 * figures for anyone signed in, an institute's own figures for its members.
 * Only after that is the file fetched from the private bucket with the service
 * role, pinned to the exact path of that row. 404 for anything else, never a
 * hint that it exists.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });

  const supabase = await createServerSupabaseClient();
  const { data: asset } = await supabase
    .from("question_assets")
    .select("storage_path, owner_institute_id")
    .eq("id", id)
    .maybeSingle();
  if (!asset) return new Response("Not found", { status: 404 });

  const { data: file, error } = await createAdminClient().storage.from("question-assets").download(asset.storage_path);
  if (error || !file) return new Response("Not found", { status: 404 });

  const ext = asset.storage_path.split(".").pop()?.toLowerCase() ?? "";
  return new Response(file, {
    headers: {
      "Content-Type": TYPES[ext] ?? "application/octet-stream",
      // private: it passed a per-viewer check. A figure never changes (a new one gets a new id).
      "Cache-Control": "private, max-age=604800, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
