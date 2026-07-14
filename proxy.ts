import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export const proxy = createMiddleware(routing);

export const config = {
  // icon/apple-icon/opengraph-image are Next.js metadata routes with no file
  // extension in their URL (just a cache-busting query string), so the
  // dot-based static-file exclusion below doesn't catch them — without this
  // explicit exclusion, next-intl rewrites /icon to /en/icon (no matching
  // route under app/[locale]) and it 404s.
  matcher: [
    "/((?!api|admin|_next|_vercel|icon|apple-icon|opengraph-image|favicon\\.ico|.*\\..*).*)",
  ],
};
