import type {
  SessionDto,
  SessionSummaryDto,
  VolumePeriodDto,
} from "@/types/domain";

/** One page of the history list. nextCursor feeds `before` on the next call. */
export interface HistoryPageDto {
  sessions: SessionSummaryDto[];
  nextCursor: string | null;
}

export interface PeriodSummaryDto extends VolumePeriodDto {
  strengthCount: number;
  cardioCount: number;
}

export interface SummaryResponseDto {
  period: "week" | "month";
  current: PeriodSummaryDto;
  /** Most recent first, including the current period. */
  periods: PeriodSummaryDto[];
  /** Sessions that count toward `current`, newest first. */
  sessions: SessionSummaryDto[];
}

export interface SessionDetailDto {
  session: SessionDto;
  locationName: string | null;
}

export interface TodayDataDto {
  date: string;
  sessions: SessionSummaryDto[];
  hasExercises: boolean;
}
