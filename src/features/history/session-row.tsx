import { sessionDetail, sessionTitle } from "@/features/history/format";
import type { SessionSummaryDto } from "@/types/domain";
import { ListRow } from "@/ui/ListRow";

export type SessionRowProps = {
  session: SessionSummaryDto;
  /** Show the date in the detail line (history lists). */
  withDate?: boolean;
  /** Where the row goes; defaults to the history summary. */
  href?: string;
  /** Show "In progress" / "Finished" for strength sessions. */
  showStatus?: boolean;
};

export function SessionRow({
  session,
  withDate = false,
  href,
  showStatus = false,
}: SessionRowProps) {
  const status =
    showStatus && session.kind === "strength"
      ? session.finishedAt
        ? "Finished"
        : "In progress"
      : undefined;
  return (
    <ListRow
      title={sessionTitle(session)}
      detail={sessionDetail(session, withDate)}
      trailing={status}
      href={href ?? `/history/${session.id}`}
    />
  );
}
