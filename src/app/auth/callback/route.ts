import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/db/server";

/**
 * OAuth callback. Exchanges the authorization code for a session, then sends the
 * user on. A brand-new sign-in belongs to no institute, so /welcome is the
 * correct default landing place — it is the screen that offers an invite to
 * accept or a batch code to enter, and nothing else.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const oauthError = searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=exchange`);
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=exchange`);
  }

  // Only allow same-origin relative paths through, so `next` cannot be used as
  // an open redirect.
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/welcome";
  return NextResponse.redirect(`${origin}${safeNext}`);
}
