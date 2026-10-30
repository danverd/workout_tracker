import Link from "next/link";
import { connection } from "next/server";

import { getDb } from "@/db/client";
import { listLocations } from "@/db/queries/setup";
import { AppShell } from "@/ui/AppShell";
import { buttonClass } from "@/ui/button-styles";
import { EmptyState } from "@/ui/EmptyState";
import { ListRow } from "@/ui/ListRow";
import { ScreenHeader } from "@/ui/ScreenHeader";

const equipmentCount = (n: number) =>
  `${n} ${n === 1 ? "item" : "items"} of equipment`;

export default async function LocationsPage() {
  await connection();
  const locations = await listLocations(await getDb());
  const active = locations.filter((l) => !l.archived);
  const archived = locations.filter((l) => l.archived);

  return (
    <AppShell
      header={
        <ScreenHeader
          title="Locations"
          backHref="/setup"
          backLabel="Back to setup"
          action={
            <Link href="/setup/locations/new" className={buttonClass("quiet")}>
              Add location
            </Link>
          }
        />
      }
    >
      {active.length === 0 ? (
        <EmptyState
          message="Add the equipment you have, then create a location for where you train."
          action={
            <Link
              href="/setup/locations/new"
              className={buttonClass("primary")}
            >
              Add location
            </Link>
          }
        />
      ) : (
        active.map((location) => (
          <ListRow
            key={location.id}
            href={`/setup/locations/${location.id}`}
            title={location.name}
            detail={equipmentCount(location.equipment.length)}
          />
        ))
      )}
      {archived.length > 0 ? (
        <section className="pt-6" aria-label="Archived locations">
          <h2 className="font-display text-title text-rubber pb-1 font-semibold">
            Archived
          </h2>
          {archived.map((location) => (
            <ListRow
              key={location.id}
              href={`/setup/locations/${location.id}`}
              title={location.name}
              detail={equipmentCount(location.equipment.length)}
            />
          ))}
        </section>
      ) : null}
    </AppShell>
  );
}
