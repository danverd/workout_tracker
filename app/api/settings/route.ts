import { getSettings } from "@/db/queries/setup";
import { updateSettings } from "@/features/setup/mutations";
import { handleRead, handleWrite } from "@/features/setup/route";
import { settingsInputSchema } from "@/lib/validation/setup";

export const GET = () => handleRead((db) => getSettings(db));

export const PUT = (request: Request) =>
  handleWrite(request, settingsInputSchema, (db, input) =>
    updateSettings(db, input),
  );
