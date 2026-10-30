import { createHmac } from "node:crypto";
import { and, count, eq, gt, lt } from "drizzle-orm";
import { getDb } from "@/db/client";
import { failedPasscodeAttempts } from "@/db/schema";

const WINDOW_MS = 15 * 60_000;

export function hashClientIdentifier(value: string) {
  const secret = process.env.IP_HASH_SECRET;
  if (!secret) throw new Error("IP_HASH_SECRET is required.");
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function clientIdentifier(forwardedFor: string | null) {
  return forwardedFor?.split(",").at(-1)?.trim() || "unknown";
}
export async function tooManyAttempts(identifierHash: string) {
  const db = await getDb();
  const [row] = await db
    .select({ total: count() })
    .from(failedPasscodeAttempts)
    .where(
      and(
        eq(failedPasscodeAttempts.identifierHash, identifierHash),
        gt(
          failedPasscodeAttempts.attemptedAt,
          new Date(Date.now() - WINDOW_MS),
        ),
      ),
    );
  return row.total >= 5;
}
export async function recordFailedAttempt(identifierHash: string) {
  const db = await getDb();
  await db.insert(failedPasscodeAttempts).values({ identifierHash });
  // Attempts outside the window can no longer matter.
  await db
    .delete(failedPasscodeAttempts)
    .where(
      lt(failedPasscodeAttempts.attemptedAt, new Date(Date.now() - WINDOW_MS)),
    );
}
