import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { deleteSet, SessionQueryError, upsertSet } from "@/db/queries/sessions";
import {
  guarded,
  parseId,
  readJson,
  type SetParams,
} from "@/features/session/route";
import { sessionSetInputSchema } from "@/lib/validation/sessions";

export function PUT(request: Request, { params }: SetParams) {
  return guarded("mutation", async () => {
    const { id, exerciseId, setId } = await params;
    const body = sessionSetInputSchema.parse(await readJson(request));
    if (body.id !== parseId(setId))
      throw new SessionQueryError(400, "Set id does not match the URL.");
    return NextResponse.json(
      await upsertSet(await getDb(), parseId(id), parseId(exerciseId), body),
    );
  });
}

export function DELETE(_request: Request, { params }: SetParams) {
  return guarded("mutation", async () => {
    const { id, exerciseId, setId } = await params;
    await deleteSet(
      await getDb(),
      parseId(id),
      parseId(exerciseId),
      parseId(setId),
    );
    return new NextResponse(null, { status: 204 });
  });
}
