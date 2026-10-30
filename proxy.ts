import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const publicPath =
    request.nextUrl.pathname === "/login" ||
    request.nextUrl.pathname.startsWith("/api/session");
  if (!publicPath && !request.cookies.get("workout_session"))
    return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

// Static app assets (fetched by browsers without cookies) stay public.
export const config = {
  matcher: [
    "/((?!_next|favicon.ico|icon.svg|icon-.*\\.png|apple-touch-icon.*\\.png|manifest.webmanifest).*)",
  ],
};
