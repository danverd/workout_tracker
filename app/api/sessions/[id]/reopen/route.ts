import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { reopenSession } from "@/db/queries/sessions";
import {
  guarded,
  parseId,
  readJson,
  type IdParams,
} from "@/features/session/route";
import { sessionReopenSchema } from "@/lib/validation/sessions";

export function POST(request: Request, { params }: IdParams) {
  return guarded("mutation", async () => {
    const id = parseId((await params).id);
    sessionReopenSchema.parse(await readJson(request));
    return NextResponse.json(await reopenSession(await getDb(), id));
  });
}
