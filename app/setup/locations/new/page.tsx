import { connection } from "next/server";

import { getDb } from "@/db/client";
import { listEquipment } from "@/db/queries/setup";
import { LocationForm } from "@/features/setup/LocationForm";
import { AppShell } from "@/ui/AppShell";
import { ScreenHeader } from "@/ui/ScreenHeader";

export default async function NewLocationPage() {
  await connection();
  const equipment = await listEquipment(await getDb());
  return (
    <AppShell
      header={
        <ScreenHeader
          title="New location"
          backHref="/setup/locations"
          backLabel="Back to locations"
        />
      }
    >
      <LocationForm equipment={equipment} />
    </AppShell>
  );
}
