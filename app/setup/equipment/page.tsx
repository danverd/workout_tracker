import { connection } from "next/server";

import { getDb } from "@/db/client";
import { listEquipment } from "@/db/queries/setup";
import { NameListManager } from "@/features/setup/NameListManager";
import { AppShell } from "@/ui/AppShell";
import { ScreenHeader } from "@/ui/ScreenHeader";

export default async function EquipmentPage() {
  await connection();
  const rows = await listEquipment(await getDb());
  return (
    <AppShell
      header={
        <ScreenHeader
          title="Equipment"
          backHref="/setup"
          backLabel="Back to setup"
        />
      }
    >
      <NameListManager kind="equipment" initialRows={rows} />
    </AppShell>
  );
}
