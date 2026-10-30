import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import {
  getActiveProgramId,
  getPickerOptions,
  getProgram,
} from "@/db/queries/programs";
import { ProgramBuilder } from "@/features/programs/ProgramBuilder";
import { idSchema } from "@/lib/validation/setup";

export default async function ProgramPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const parsedId = idSchema.safeParse((await params).id);
  if (!parsedId.success) notFound();
  const db = await getDb();
  const [program, activeId, options] = await Promise.all([
    getProgram(db, parsedId.data),
    getActiveProgramId(db),
    getPickerOptions(db),
  ]);
  if (!program) notFound();
  return (
    <ProgramBuilder
      program={program}
      active={activeId === program.id}
      movements={options.movements}
      exercises={options.exercises}
    />
  );
}
