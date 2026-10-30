import { and, eq, ne, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import * as s from "@/db/schema";

type NamedTable =
  | typeof s.equipment
  | typeof s.movements
  | typeof s.locations
  | typeof s.exercises;

type ArchivableTable =
  typeof s.locations | typeof s.exercises | typeof s.programs;

/** Case-insensitive name clash with another row (not `exceptId`). */
export async function nameTaken(
  db: Database,
  table: NamedTable,
  name: string,
  exceptId?: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: table.id })
    .from(table as typeof s.equipment)
    .where(
      and(
        sql`lower(${table.name}) = lower(${name})`,
        exceptId ? ne(table.id, exceptId) : undefined,
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** Sets or clears `archivedAt`; false when no row has that id. */
export async function setArchived(
  db: Database,
  table: ArchivableTable,
  id: string,
  archived: boolean,
): Promise<boolean> {
  // The three tables share the same id/archivedAt columns, so one typed
  // table stands in for the union.
  const t = table as typeof s.locations;
  const rows = await db
    .update(t)
    .set({ archivedAt: archived ? new Date() : null })
    .where(eq(t.id, id))
    .returning({ id: t.id });
  return rows.length > 0;
}
