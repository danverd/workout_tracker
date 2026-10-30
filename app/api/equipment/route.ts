import { listEquipment } from "@/db/queries/setup";
import { createEquipment } from "@/features/setup/mutations";
import { handleRead, handleWrite } from "@/features/setup/route";
import { equipmentInputSchema } from "@/lib/validation/setup";

export const GET = () => handleRead((db) => listEquipment(db));

export const POST = (request: Request) =>
  handleWrite(
    request,
    equipmentInputSchema,
    (db, input) => createEquipment(db, input),
    201,
  );
