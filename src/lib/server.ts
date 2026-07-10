import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { cookieName, isAuthenticated } from "@/lib/auth";

export async function requireSession() {
  if (!(await isAuthenticated((await cookies()).get(cookieName)?.value)))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return null;
}
export async function requireSameOrigin() {
  const origin = (await headers()).get("origin");
  const host = (await headers()).get("host");
  let originHost: string | undefined;
  try {
    originHost = origin ? new URL(origin).host : undefined;
  } catch {
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 },
    );
  }
  if (originHost && host && originHost !== host)
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 },
    );
  return null;
}

export async function requireMutationSession() {
  return (await requireSession()) ?? (await requireSameOrigin());
}
