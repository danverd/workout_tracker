import Link from "next/link";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import { getTodayData } from "@/db/queries/history";
import { SessionRow } from "@/features/history/session-row";
import { formatDay } from "@/features/history/format";
import { TodayActions } from "@/features/today/today-actions";
import { todayInAppTimeZone } from "@/lib/dates";
import { buttonClass } from "@/ui/button-styles";
import { AppShell } from "@/ui/AppShell";
import { EmptyState } from "@/ui/EmptyState";
import { ScreenHeader } from "@/ui/ScreenHeader";

export default async function TodayPage() {
  await connection();
  const today = todayInAppTimeZone();
  const data = await getTodayData(await getDb(), today);

  return (
    <AppShell header={<ScreenHeader title={formatDay(today)} />}>
      {data.hasExercises || data.sessions.length > 0 ? (
        <div className="flex flex-col gap-6">
          {data.sessions.length > 0 ? (
            <section aria-label="Today's sessions">
              {data.sessions.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  showStatus
                  href={
                    session.kind === "strength"
                      ? `/session/${session.id}`
                      : `/history/${session.id}`
                  }
                />
              ))}
            </section>
          ) : (
            <p className="text-lead text-rubber">Nothing logged yet today.</p>
          )}
          <TodayActions sessions={data.sessions} />
        </div>
      ) : (
        <EmptyState
          message="Set up your equipment and exercises to start lifting."
          action={
            <Link href="/setup" className={buttonClass("primary")}>
              Open setup
            </Link>
          }
        />
      )}
    </AppShell>
  );
}
