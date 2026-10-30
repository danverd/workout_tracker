import {
  deleteLocation,
  setLocationArchived,
  updateLocation,
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
  locationInputSchema,
} from "@/lib/validation/setup";

export async function PUT(request: Request, context: IdContext) {
  const id = await readId(context);
  if (!id) return notFound();
  return handleWrite(request, locationInputSchema, (db, input) =>
    updateLocation(db, id, input),
  );
}

export async function PATCH(request: Request, context: IdContext) {
  const id = await readId(context);
  if (!id) return notFound();
  return handleWrite(request, archiveInputSchema, (db, input) =>
    setLocationArchived(db, id, input.archived),
  );
}

export async function DELETE(_request: Request, context: IdContext) {
  const id = await readId(context);
  if (!id) return notFound();
  return handleAction((db) => deleteLocation(db, id));
}
