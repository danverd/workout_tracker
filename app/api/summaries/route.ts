import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { getSummary } from "@/db/queries/history";
import { requireSession } from "@/lib/server";
import { summaryQuerySchema } from "@/lib/validation/history";

export async function GET(request: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  const parsed = summaryQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid query." }, { status: 400 });
  return NextResponse.json(await getSummary(await getDb(), parsed.data));
}
