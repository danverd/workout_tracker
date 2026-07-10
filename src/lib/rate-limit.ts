import { createHmac } from "node:crypto";
import { and, count, eq, gt } from "drizzle-orm";
import { database } from "@/db/client";
import { failedPasscodeAttempts } from "@/db/schema";

export function hashClientIdentifier(value: string) {
  const secret = process.env.IP_HASH_SECRET;
  if (!secret) throw new Error("IP_HASH_SECRET is required.");
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function clientIdentifier(forwardedFor: string | null) {
  return forwardedFor?.split(",").at(-1)?.trim() || "unknown";
}
export async function tooManyAttempts(identifierHash: string) {
  const db = database();
  const [row] = await db
    .select({ total: count() })
    .from(failedPasscodeAttempts)
    .where(
      and(
        eq(failedPasscodeAttempts.identifierHash, identifierHash),
        gt(
          failedPasscodeAttempts.attemptedAt,
          new Date(Date.now() - 15 * 60_000),
        ),
      ),
    );
  return row.total >= 5;
}
export async function recordFailedAttempt(identifierHash: string) {
  await database().insert(failedPasscodeAttempts).values({ identifierHash });
}
