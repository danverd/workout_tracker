import { getDb } from "@/db/client";
import { listExercises } from "@/db/queries/setup";
import { createExercise } from "@/features/setup/mutations";
import { created, parseJson, route } from "@/lib/http";
import { exerciseInputSchema } from "@/lib/validation/setup";

export const GET = route("read", async () => listExercises(await getDb()));

export const POST = route("mutation", async (request) =>
  created(
    await createExercise(
      await getDb(),
      await parseJson(request, exerciseInputSchema),
    ),
  ),
);
