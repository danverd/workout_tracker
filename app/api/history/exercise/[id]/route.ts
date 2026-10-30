import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { getExerciseHistory } from "@/db/queries/history";
import { requireSession } from "@/lib/server";
import { exerciseHistoryQuerySchema } from "@/lib/validation/history";
import { idSchema } from "@/lib/validation/setup";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireSession();
  if (denied) return denied;
  const { id } = await params;
  const query = exerciseHistoryQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!idSchema.safeParse(id).success || !query.success)
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const history = await getExerciseHistory(await getDb(), id, query.data.limit);
  if (!history)
    return NextResponse.json({ error: "Exercise not found." }, { status: 404 });
  return NextResponse.json(history);
}
