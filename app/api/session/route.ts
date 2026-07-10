import { NextResponse } from "next/server";
import { createSession, cookieName, verifyPasscode } from "@/lib/auth";
import {
  hashClientIdentifier,
  clientIdentifier,
  recordFailedAttempt,
  tooManyAttempts,
} from "@/lib/rate-limit";
import { requireSameOrigin } from "@/lib/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const passcode = body?.passcode;
  const identifier = hashClientIdentifier(
    clientIdentifier(request.headers.get("x-forwarded-for")),
  );
  if (await tooManyAttempts(identifier))
    return NextResponse.json({ error: "Unable to sign in." }, { status: 429 });
  if (typeof passcode !== "string" || !verifyPasscode(passcode)) {
    await recordFailedAttempt(identifier);
    return NextResponse.json({ error: "Unable to sign in." }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookieName, await createSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return response;
}

export async function DELETE() {
  const denied = await requireSameOrigin();
  if (denied) return denied;
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(cookieName);
  return response;
}
