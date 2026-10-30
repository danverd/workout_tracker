import { connection } from "next/server";

import { getDb } from "@/db/client";
import { listMovements } from "@/db/queries/setup";
import { NameListManager } from "@/features/setup/NameListManager";
import { AppShell } from "@/ui/AppShell";
import { ScreenHeader } from "@/ui/ScreenHeader";

export default async function MovementsPage() {
  await connection();
  const rows = await listMovements(await getDb());
  return (
    <AppShell
      header={
        <ScreenHeader
          title="Movements"
          backHref="/setup"
          backLabel="Back to setup"
        />
      }
    >
      <NameListManager kind="movements" initialRows={rows} />
    </AppShell>
  );
}
