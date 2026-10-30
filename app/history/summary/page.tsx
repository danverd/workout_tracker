import { connection } from "next/server";
import { getDb } from "@/db/client";
import { getSummary } from "@/db/queries/history";
import { SummaryView } from "@/features/history/summary-view";
import { todayInAppTimeZone } from "@/lib/dates";
import { AppShell } from "@/ui/AppShell";
import { ScreenHeader } from "@/ui/ScreenHeader";

export default async function SummaryPage() {
  await connection();
  const today = todayInAppTimeZone();
  const initial = await getSummary(await getDb(), {
    period: "week",
    anchor: today,
  });
  return (
    <AppShell
      header={
        <ScreenHeader title="Summary" backHref="/history" backLabel="History" />
      }
    >
      <SummaryView initial={initial} today={today} />
    </AppShell>
  );
}
