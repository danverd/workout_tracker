import { NextResponse } from "next/server";
import { getSummary } from "@/db/queries";
import { monthBounds, weekBounds } from "@/lib/dates";
import { requireSession } from "@/lib/server";
import { summaryQuerySchema } from "@/lib/validation";
export async function GET(request: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  const url = new URL(request.url);
  const parsed = summaryQuerySchema.safeParse({
    period: url.searchParams.get("period"),
    anchor: url.searchParams.get("anchor"),
  });
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid summary request." },
      { status: 400 },
    );
  const bounds =
    parsed.data.period === "week"
      ? weekBounds(parsed.data.anchor)
      : monthBounds(parsed.data.anchor);
  return NextResponse.json({
    ...bounds,
    ...(await getSummary(bounds.start, bounds.end)),
  });
}
