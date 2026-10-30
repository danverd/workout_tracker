import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { finishSession } from "@/db/queries/sessions";
import {
  guarded,
  parseId,
  readJson,
  type IdParams,
} from "@/features/session/route";
import { sessionFinishSchema } from "@/lib/validation/sessions";

export function POST(request: Request, { params }: IdParams) {
  return guarded("mutation", async () => {
    const id = parseId((await params).id);
    const { finishedAt } = sessionFinishSchema.parse(await readJson(request));
    return NextResponse.json(
      await finishSession(await getDb(), id, finishedAt),
    );
  });
}
