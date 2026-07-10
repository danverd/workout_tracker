import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { database } from "@/db/client";
import { workoutInstances } from "@/db/schema";
import { requireMutationSession } from "@/lib/server";
export async function POST(
  _: Request,
  { params }: { params: Promise<{ date: string }> },
) {
  const denied = await requireMutationSession();
  if (denied) return denied;
  const date = (await params).date;
  const db = database();
  const rows = await db
    .update(workoutInstances)
    .set({ status: "finished", updatedAt: new Date() })
    .where(eq(workoutInstances.workoutDate, date))
    .returning();
  return rows.length
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "Workout not found." }, { status: 404 });
}
