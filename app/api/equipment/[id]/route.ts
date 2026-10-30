import { deleteEquipment, updateEquipment } from "@/features/setup/mutations";
import {
  handleAction,
  handleWrite,
  notFound,
  readId,
  type IdContext,
} from "@/features/setup/route";
import { equipmentInputSchema } from "@/lib/validation/setup";

export async function PUT(request: Request, context: IdContext) {
  const id = await readId(context);
  if (!id) return notFound();
  return handleWrite(request, equipmentInputSchema, (db, input) =>
    updateEquipment(db, id, input),
  );
}

export async function DELETE(_request: Request, context: IdContext) {
  const id = await readId(context);
  if (!id) return notFound();
  return handleAction((db) => deleteEquipment(db, id));
}
