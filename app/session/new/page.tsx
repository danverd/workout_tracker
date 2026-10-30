import { connection } from "next/server";
import { getDb } from "@/db/client";
import { loadCatalog } from "@/db/queries/sessions";
import { NewSession } from "@/features/session/NewSession";
import { AppShell } from "@/ui/AppShell";
import { ScreenHeader } from "@/ui/ScreenHeader";

export const metadata = { title: "Start lifting" };

export default async function NewSessionPage() {
  await connection();
  const catalog = await loadCatalog(await getDb());
  return (
    <AppShell
      header={
        <ScreenHeader
          title="Start lifting"
          backHref="/"
          backLabel="Back to Today"
        />
      }
    >
      <NewSession catalog={catalog} />
    </AppShell>
  );
}
