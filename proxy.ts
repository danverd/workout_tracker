import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const publicPath = pathname === "/login" || pathname === "/api/session";
  if (publicPath || request.cookies.get(SESSION_COOKIE))
    return NextResponse.next();
  if (pathname.startsWith("/api/"))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.redirect(new URL("/login", request.url));
}

// Static assets are fetched by browsers without a cookie, so they bypass the
// proxy. Keep this list in step with public/ and app/ metadata files:
// favicon.ico, icon.svg, icon-192.png, icon-512.png, icon-maskable-512.png,
// apple-touch-icon.png and manifest.webmanifest (served by app/manifest.ts).
export const config = {
  matcher: [
    "/((?!_next|favicon.ico|icon.svg|icon-.*\\.png|apple-touch-icon.*\\.png|manifest.webmanifest).*)",
  ],
};
