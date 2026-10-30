import {
  deleteExercise,
  setExerciseArchived,
  updateExercise,
} from "@/features/setup/mutations";
import {
  handleAction,
  handleWrite,
  notFound,
  readId,
  type IdContext,
} from "@/features/setup/route";
import {
  archiveInputSchema,
  exerciseInputSchema,
} from "@/lib/validation/setup";

export async function PUT(request: Request, context: IdContext) {
  const id = await readId(context);
  if (!id) return notFound();
  return handleWrite(request, exerciseInputSchema, (db, input) =>
    updateExercise(db, id, input),
  );
}

export async function PATCH(request: Request, context: IdContext) {
  const id = await readId(context);
  if (!id) return notFound();
  return handleWrite(request, archiveInputSchema, (db, input) =>
    setExerciseArchived(db, id, input.archived),
  );
}

export async function DELETE(_request: Request, context: IdContext) {
  const id = await readId(context);
  if (!id) return notFound();
  return handleAction((db) => deleteExercise(db, id));
}
