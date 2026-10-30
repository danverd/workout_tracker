import { connection } from "next/server";
import { getDb } from "@/db/client";
import { recentActivities } from "@/db/queries/cardio";
import { CardioForm } from "@/features/cardio/cardio-form";
import { AppShell } from "@/ui/AppShell";
import { ScreenHeader } from "@/ui/ScreenHeader";

export default async function NewCardioPage() {
  await connection();
  const recent = await recentActivities(await getDb());
  return (
    <AppShell
      header={
        <ScreenHeader title="Log cardio" backHref="/" backLabel="Today" />
      }
    >
      <CardioForm recent={recent} />
    </AppShell>
  );
}
