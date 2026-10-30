import { deleteMovement, updateMovement } from "@/features/setup/mutations";
import {
  handleAction,
  handleWrite,
  notFound,
  readId,
  type IdContext,
} from "@/features/setup/route";
import { movementInputSchema } from "@/lib/validation/setup";

export async function PUT(request: Request, context: IdContext) {
  const id = await readId(context);
  if (!id) return notFound();
  return handleWrite(request, movementInputSchema, (db, input) =>
    updateMovement(db, id, input),
  );
}

export async function DELETE(_request: Request, context: IdContext) {
  const id = await readId(context);
  if (!id) return notFound();
  return handleAction((db) => deleteMovement(db, id));
}
