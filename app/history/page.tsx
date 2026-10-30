import Link from "next/link";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import { listHistory } from "@/db/queries/history";
import { HistoryList } from "@/features/history/history-list";
import { buttonClass } from "@/ui/button-styles";
import { AppShell } from "@/ui/AppShell";
import { EmptyState } from "@/ui/EmptyState";
import { ScreenHeader } from "@/ui/ScreenHeader";

export default async function HistoryPage() {
  await connection();
  const page = await listHistory(await getDb(), {});
  return (
    <AppShell
      header={
        <ScreenHeader
          title="History"
          action={
            <Link
              href="/history/summary"
              className={`${buttonClass("quiet")} !min-h-11`}
            >
              Summary
            </Link>
          }
        />
      }
    >
      {page.sessions.length > 0 ? (
        <HistoryList initial={page} />
      ) : (
        <EmptyState
          message="Finished workouts show up here. Start your first one."
          action={
            <Link href="/session/new" className={buttonClass("secondary")}>
              Start lifting
            </Link>
          }
        />
      )}
    </AppShell>
  );
}
