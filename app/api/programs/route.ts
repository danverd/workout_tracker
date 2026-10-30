import { getDb } from "@/db/client";
import { createProgram, listPrograms } from "@/db/queries/programs";
import { created, parseJson, route } from "@/lib/http";
import { programSaveSchema } from "@/lib/validation/programs";

export const GET = route("read", async (request) =>
  listPrograms(await getDb(), {
    includeArchived: new URL(request.url).searchParams.get("archived") === "1",
  }),
);

export const POST = route("mutation", async (request) =>
  created(
    await createProgram(
      await getDb(),
      await parseJson(request, programSaveSchema),
    ),
  ),
);
