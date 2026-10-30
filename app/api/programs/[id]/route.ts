import { getDb } from "@/db/client";
import { getProgram, saveProgram } from "@/db/queries/programs";
import { HttpError, parseId, parseJson, route } from "@/lib/http";
import { programSaveSchema } from "@/lib/validation/programs";

type Params = { id: string };

const notFound = () => new HttpError(404, "Program not found.");

export const GET = route<Params>("read", async (_request, { id }) => {
  const program = await getProgram(await getDb(), parseId(id));
  if (!program) throw notFound();
  return program;
});

export const PUT = route<Params>("mutation", async (request, { id }) => {
  const input = await parseJson(request, programSaveSchema);
  const program = await saveProgram(await getDb(), parseId(id), input);
  if (!program) throw notFound();
  return program;
});
