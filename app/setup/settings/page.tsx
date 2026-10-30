import { connection } from "next/server";

import { getDb } from "@/db/client";
import { getSettings } from "@/db/queries/setup";
import { SettingsForm } from "@/features/setup/SettingsForm";
import { AppShell } from "@/ui/AppShell";
import { ScreenHeader } from "@/ui/ScreenHeader";

export default async function SettingsPage() {
  await connection();
  const settings = await getSettings(await getDb());
  return (
    <AppShell
      header={
        <ScreenHeader
          title="Settings"
          backHref="/setup"
          backLabel="Back to setup"
        />
      }
    >
      <SettingsForm bodyweightLb={settings.bodyweightLb} />
    </AppShell>
  );
}
