import Link from "next/link";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import {
  countArchivedPrograms,
  getPickerOptions,
  listPrograms,
} from "@/db/queries/programs";
import { AppShell } from "@/ui/AppShell";
import { buttonClass } from "@/ui/button-styles";
import { EmptyState } from "@/ui/EmptyState";
import { ListRow } from "@/ui/ListRow";
import { ScreenHeader } from "@/ui/ScreenHeader";

export default async function ProgramsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  await connection();
  const showArchived = (await searchParams).archived === "1";
  const db = await getDb();
  const [programs, archivedCount, options] = await Promise.all([
    listPrograms(db, { includeArchived: showArchived }),
    countArchivedPrograms(db),
    getPickerOptions(db),
  ]);
  const nothingToTrain =
    options.movements.length === 0 && options.exercises.length === 0;

  return (
    <AppShell
      header={
        <ScreenHeader
          title="Programs"
          action={
            programs.length > 0 ? (
              <Link href="/programs/new" className={buttonClass("secondary")}>
                New program
              </Link>
            ) : undefined
          }
        />
      }
    >
      {nothingToTrain ? (
        <p className="text-body text-steel pb-4">
          You have no movements or exercises yet, so days will be empty.{" "}
          <Link href="/setup" className="text-plate-blue underline">
            Add them in Setup
          </Link>
          .
        </p>
      ) : null}

      {programs.length === 0 ? (
        <EmptyState
          message="A program is a set of days, like Push, Pull and Legs. Create one to choose what you train each day."
          action={
            <Link href="/programs/new" className={buttonClass("primary")}>
              New program
            </Link>
          }
        />
      ) : (
        <ul className="border-hairline border-t">
          {programs.map((program) => (
            <li key={program.id}>
              <ListRow
                href={`/programs/${program.id}`}
                title={program.name}
                detail={
                  program.dayNames.length > 0
                    ? `${program.dayNames.join(", ")} · ${program.slotCount} slots`
                    : "No days yet"
                }
                trailing={
                  program.active ? (
                    <span className="text-plate-blue-deep font-medium">
                      Active
                    </span>
                  ) : program.archived ? (
                    <span>Archived</span>
                  ) : undefined
                }
              />
            </li>
          ))}
        </ul>
      )}

      {archivedCount > 0 ? (
        <div className="pt-4">
          <Link
            href={showArchived ? "/programs" : "/programs?archived=1"}
            className={buttonClass("quiet")}
          >
            {showArchived ? "Hide archived" : "Show archived"}
          </Link>
        </div>
      ) : null}
    </AppShell>
  );
}
