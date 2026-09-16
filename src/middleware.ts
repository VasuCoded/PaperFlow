import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Refreshes the Supabase session cookie on every request, and gates the
 * protected areas.
 *
 * Two rules from the plan are load-bearing here:
 *  - Unauthorised access returns 404, NOT 403, so the route map does not leak
 *    (BUILD-PLAN C2 item 4).
 *  - Role is read from the database on every request, never from a JWT custom
 *    claim, a cookie or client state (C2 item 4b). Middleware therefore does the
 *    cheap check (is there a user) and each layout does the authoritative role
 *    check server-side via getSession().
 */
const PROTECTED = ["/platform", "/institute", "/teacher", "/app", "/welcome"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Without Supabase configured the app cannot authenticate anyone; let the
  // request through so the setup page can explain itself.
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED.some((p) => path === p || path.startsWith(`${p}/`));

  if (isProtected && !user) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(login);
  }

  if (path === "/login" && user) {
    const home = request.nextUrl.clone();
    home.pathname = "/welcome";
    home.search = "";
    return NextResponse.redirect(home);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets, images and the print/demo routes.
     * `/demo` is deliberately excluded — it has no auth at all.
     */
    "/((?!_next/static|_next/image|favicon.ico|demo|print|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?|ico)$).*)",
  ],
};
