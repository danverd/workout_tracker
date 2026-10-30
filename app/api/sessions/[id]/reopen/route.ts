import { getDb } from "@/db/client";
import { reopenSession } from "@/db/queries/sessions";
import { parseId, parseJson, route } from "@/lib/http";
import { sessionReopenSchema } from "@/lib/validation/sessions";

export const POST = route<{ id: string }>(
  "mutation",
  async (request, { id }) => {
    const sessionId = parseId(id);
    await parseJson(request, sessionReopenSchema);
    return reopenSession(await getDb(), sessionId);
  },
);
