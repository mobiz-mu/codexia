import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { checkAdminSession } from "./lib/supabase/middleware";

const intlMiddleware = createMiddleware(routing);

// Next.js only supports one proxy.ts per project, so the two concerns are
// composed here rather than each owning a separate file: admin routes get
// an optimistic Supabase auth gate (redirect before the protected route
// tree ever renders — see lib/supabase/middleware.ts for why this can't be
// a cookie-only check), everything else keeps the exact next-intl behavior
// it already had. Neither branch runs for the other's paths.
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/admin")) {
    return checkAdminSession(request);
  }
  return intlMiddleware(request);
}

export const config = {
  // icon/apple-icon/opengraph-image are Next.js metadata routes with no file
  // extension in their URL (just a cache-busting query string), so the
  // dot-based static-file exclusion below doesn't catch them — without this
  // explicit exclusion, next-intl rewrites /icon to /en/icon (no matching
  // route under app/[locale]) and it 404s.
  matcher: [
    "/((?!api|admin|_next|_vercel|icon|apple-icon|opengraph-image|favicon\\.ico|.*\\..*).*)",
    "/admin/:path*",
  ],
};
