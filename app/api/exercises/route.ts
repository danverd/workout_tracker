import { listExercises } from "@/db/queries/setup";
import { createExercise } from "@/features/setup/mutations";
import { handleRead, handleWrite } from "@/features/setup/route";
import { exerciseInputSchema } from "@/lib/validation/setup";

export const GET = () => handleRead((db) => listExercises(db));

export const POST = (request: Request) =>
  handleWrite(
    request,
    exerciseInputSchema,
    (db, input) => createExercise(db, input),
    201,
  );
