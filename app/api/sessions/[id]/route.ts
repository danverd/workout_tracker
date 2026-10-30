import { getDb } from "@/db/client";
import { createSession, getSession, patchSession } from "@/db/queries/sessions";
import { HttpError, parseId, parseJson, route } from "@/lib/http";
import {
  sessionCreateSchema,
  sessionPatchSchema,
} from "@/lib/validation/sessions";

type Params = { id: string };

export const GET = route<Params>("read", async (_request, { id }) => {
  const session = await getSession(await getDb(), parseId(id));
  if (!session) throw new HttpError(404, "Session not found.");
  return session;
});

/** Idempotent create: the client generates every id. */
export const PUT = route<Params>("mutation", async (request, { id }) => {
  const sessionId = parseId(id);
  const body = await parseJson(request, sessionCreateSchema);
  if (body.id !== sessionId)
    throw new HttpError(400, "Session id does not match the URL.");
  return createSession(await getDb(), body);
});

export const PATCH = route<Params>("mutation", async (request, { id }) => {
  const sessionId = parseId(id);
  const patch = await parseJson(request, sessionPatchSchema);
  return patchSession(await getDb(), sessionId, patch);
});
