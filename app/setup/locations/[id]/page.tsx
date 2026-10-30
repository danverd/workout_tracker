import { notFound } from "next/navigation";
import { connection } from "next/server";

import { getDb } from "@/db/client";
import { getLocation, listEquipment } from "@/db/queries/setup";
import { LocationForm } from "@/features/setup/LocationForm";
import { idSchema } from "@/lib/validation/setup";
import { AppShell } from "@/ui/AppShell";
import { ScreenHeader } from "@/ui/ScreenHeader";

export default async function EditLocationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const parsed = idSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  const db = await getDb();
  const [location, equipment] = await Promise.all([
    getLocation(db, parsed.data),
    listEquipment(db),
  ]);
  if (!location) notFound();
  return (
    <AppShell
      header={
        <ScreenHeader
          title={location.name}
          backHref="/setup/locations"
          backLabel="Back to locations"
        />
      }
    >
      <LocationForm
        key={location.id}
        equipment={equipment}
        location={location}
      />
    </AppShell>
  );
}
