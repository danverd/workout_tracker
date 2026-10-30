import { getDb } from "@/db/client";
import { setProgramArchived } from "@/db/queries/programs";
import { HttpError, parseId, parseJson, route } from "@/lib/http";
import { archiveInputSchema } from "@/lib/validation/setup";

export const PATCH = route<{ id: string }>(
  "mutation",
  async (request, { id }) => {
    const { archived } = await parseJson(request, archiveInputSchema);
    const program = await setProgramArchived(
      await getDb(),
      parseId(id),
      archived,
    );
    if (!program) throw new HttpError(404, "Program not found.");
    return program;
  },
);
