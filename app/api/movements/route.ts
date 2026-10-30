import { listMovements } from "@/db/queries/setup";
import { createMovement } from "@/features/setup/mutations";
import { handleRead, handleWrite } from "@/features/setup/route";
import { movementInputSchema } from "@/lib/validation/setup";

export const GET = () => handleRead((db) => listMovements(db));

export const POST = (request: Request) =>
  handleWrite(
    request,
    movementInputSchema,
    (db, input) => createMovement(db, input),
    201,
  );
