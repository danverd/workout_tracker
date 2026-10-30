import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import {
  getSession,
  loadCatalog,
  loadSlotTargets,
} from "@/db/queries/sessions";
import { SessionLogger } from "@/features/session/SessionLogger";
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
  const targets = await loadSlotTargets(
    db,
    session.exercises.flatMap((exercise) =>
      exercise.slotId ? [exercise.slotId] : [],
    ),
  );
  const { cardio: _cardio, ...initial } = session;
  void _cardio;
  return (
    <SessionLogger initial={initial} catalog={catalog} targets={targets} />
  );
}
