import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const publicPath =
    request.nextUrl.pathname === "/login" ||
    request.nextUrl.pathname.startsWith("/api/session");
  if (!publicPath && !request.cookies.get("workout_session"))
    return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next|favicon.ico).*)"] };
