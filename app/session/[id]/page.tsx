import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import { getSession, loadCatalog } from "@/db/queries/sessions";
import { SessionLogger } from "@/features/session/SessionLogger";
import type { SetTarget } from "@/types/domain";
import { idSchema } from "@/lib/validation/setup";

export const metadata = { title: "Session" };

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const db = await getDb();
  const [session, catalog] = await Promise.all([
    getSession(db, id),
    loadCatalog(db, { excludeSessionId: id }),
  ]);
  if (!session || session.kind !== "strength") notFound();
  const wanted = new Set(
    session.exercises.flatMap((exercise) =>
      exercise.slotId ? [exercise.slotId] : [],
    ),
  );
  const targets: Record<string, SetTarget> = {};
  for (const program of catalog.programs)
    for (const day of program.days)
      for (const slot of day.slots)
        if (wanted.has(slot.id))
          targets[slot.id] = {
            sets: slot.sets,
            repMin: slot.repMin,
            repMax: slot.repMax,
            amrap: slot.amrap,
          };
  const { cardio: _cardio, ...initial } = session;
  void _cardio;
  return (
    <SessionLogger initial={initial} catalog={catalog} targets={targets} />
  );
}
