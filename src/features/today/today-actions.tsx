import Link from "next/link";
import { sessionTitle } from "@/lib/format";
import type { SessionSummaryDto } from "@/types/domain";
import { buttonClass } from "@/ui/button-styles";

/** The in-progress strength session to continue, newest first. */
function findInProgress(sessions: SessionSummaryDto[]) {
  return [...sessions]
    .reverse()
    .find((session) => session.kind === "strength" && !session.finishedAt);
}

/**
 * The one primary action: Continue when a strength session is in progress,
 * otherwise Start lifting. Log cardio is always secondary.
 */
export function TodayActions({ sessions }: { sessions: SessionSummaryDto[] }) {
  const inProgress = findInProgress(sessions);
  return (
    <div className="flex flex-col gap-3">
      {inProgress ? (
        <>
          <Link
            href={`/session/${inProgress.id}`}
            className={buttonClass("primary", true)}
          >
            Continue {sessionTitle(inProgress)}
          </Link>
          <Link href="/session/new" className={buttonClass("secondary", true)}>
            Start another workout
          </Link>
        </>
      ) : (
        <Link href="/session/new" className={buttonClass("primary", true)}>
          Start lifting
        </Link>
      )}
      <Link href="/cardio/new" className={buttonClass("secondary", true)}>
        Log cardio
      </Link>
    </div>
  );
}
