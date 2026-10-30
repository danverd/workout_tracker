import { getDb } from "@/db/client";
import { setActiveProgram } from "@/db/queries/programs";
import { parseId, route } from "@/lib/http";

export const POST = route<{ id: string }>(
  "mutation",
  async (_request, { id }) => setActiveProgram(await getDb(), parseId(id)),
);
