import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./types";

/**
 * Optimistic auth gate for `/admin/*`, run from proxy.ts before the
 * protected route tree renders at all. `getUser()` (not `getSession()`) is
 * deliberate — it revalidates the JWT against the Supabase Auth server
 * rather than trusting the cookie's contents unverified, the same
 * correctness/security tradeoff `getCurrentAdminUser()` already makes
 * server-side. This is still only the optimistic layer: it proves "is
 * there a valid session at all", not "does this user hold an admin role or
 * a specific permission" — that stays the job of `getCurrentAdminUser()` /
 * `requireAdminUser()` / `assertPermission()` in the layout and every
 * Server Action, which this does not replace.
 */
export async function checkAdminSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && request.nextUrl.pathname !== "/admin/login") {
    const loginUrl = new URL("/admin/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
