import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import {
  createSession,
  getSession,
  patchSession,
  SessionQueryError,
} from "@/db/queries/sessions";
import {
  guarded,
  parseId,
  readJson,
  type IdParams,
} from "@/features/session/route";
import {
  sessionCreateSchema,
  sessionPatchSchema,
} from "@/lib/validation/sessions";

export function GET(_request: Request, { params }: IdParams) {
  return guarded("read", async () => {
    const id = parseId((await params).id);
    const session = await getSession(await getDb(), id);
    if (!session) throw new SessionQueryError(404, "Session not found.");
    return NextResponse.json(session);
  });
}

/** Idempotent create: the client generates every id. */
export function PUT(request: Request, { params }: IdParams) {
  return guarded("mutation", async () => {
    const id = parseId((await params).id);
    const body = sessionCreateSchema.parse(await readJson(request));
    if (body.id !== id)
      throw new SessionQueryError(400, "Session id does not match the URL.");
    return NextResponse.json(await createSession(await getDb(), body));
  });
}

export function PATCH(request: Request, { params }: IdParams) {
  return guarded("mutation", async () => {
    const id = parseId((await params).id);
    const patch = sessionPatchSchema.parse(await readJson(request));
    return NextResponse.json(await patchSession(await getDb(), id, patch));
  });
}
