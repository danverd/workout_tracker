import { getDb } from "@/db/client";
import { finishSession } from "@/db/queries/sessions";
import { parseId, parseJson, route } from "@/lib/http";
import { sessionFinishSchema } from "@/lib/validation/sessions";

export const POST = route<{ id: string }>(
  "mutation",
  async (request, { id }) => {
    const sessionId = parseId(id);
    const { finishedAt } = await parseJson(request, sessionFinishSchema);
    return finishSession(await getDb(), sessionId, finishedAt);
  },
);
