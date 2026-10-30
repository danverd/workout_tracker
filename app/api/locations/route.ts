import { listLocations } from "@/db/queries/setup";
import { createLocation } from "@/features/setup/mutations";
import { handleRead, handleWrite } from "@/features/setup/route";
import { locationInputSchema } from "@/lib/validation/setup";

export const GET = () => handleRead((db) => listLocations(db));

export const POST = (request: Request) =>
  handleWrite(
    request,
    locationInputSchema,
    (db, input) => createLocation(db, input),
    201,
  );
