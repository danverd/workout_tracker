import { cookies, headers } from "next/headers";
import { SESSION_COOKIE, isAuthenticated } from "@/lib/auth";
import { HttpError } from "@/lib/http";

export async function requireSession() {
  if (!(await isAuthenticated((await cookies()).get(SESSION_COOKIE)?.value)))
    throw new HttpError(401, "Unauthorized");
}

export async function requireSameOrigin() {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  const host = requestHeaders.get("host");
  let originHost: string | undefined;
  try {
    originHost = origin ? new URL(origin).host : undefined;
  } catch {
    throw new HttpError(403, "Invalid request origin");
  }
  if (originHost && host && originHost !== host)
    throw new HttpError(403, "Invalid request origin");
}

export async function requireMutationSession() {
  await requireSession();
  await requireSameOrigin();
}
