import { NextResponse } from "next/server";
import { historyForExerciseSlugs } from "@/db/queries";
import { exerciseBySlug } from "@/lib/templates";
import { mapHistoricalWeights } from "@/lib/workout-defaults";
import { requireSession } from "@/lib/server";
import { isDateOnly } from "@/lib/dates";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const denied = await requireSession();
  if (denied) return denied;
  const date = new URL(request.url).searchParams.get("date");
  const slug = (await params).slug;
  const exercise = exerciseBySlug.get(slug);
  if (!exercise || !date || !isDateOnly(date))
    return NextResponse.json(
      { error: "Invalid exercise request." },
      { status: 400 },
    );
  const history = await historyForExerciseSlugs(date, [slug]);
  return NextResponse.json({
    weights: mapHistoricalWeights(
      exercise.defaultSets.map((set) => set.baselineInputWeight),
      history[slug] ?? [],
    ),
  });
}
