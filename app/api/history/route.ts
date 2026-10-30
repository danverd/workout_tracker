import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { listHistory } from "@/db/queries/history";
import { requireSession } from "@/lib/server";
import { historyListQuerySchema } from "@/lib/validation/history";

export async function GET(request: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  const parsed = historyListQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid query." }, { status: 400 });
  return NextResponse.json(await listHistory(await getDb(), parsed.data));
}
