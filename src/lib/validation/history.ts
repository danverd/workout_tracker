import { z } from "zod";
import { dateSchema } from "@/lib/validation/sessions";

/** GET /api/history?before=YYYY-MM-DD&limit=50 (query-string parsing). */
export const historyListQuerySchema = z.object({
  before: dateSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type HistoryListQuery = z.infer<typeof historyListQuerySchema>;

/** GET /api/summaries?period=week|month&anchor=YYYY-MM-DD&count=8 */
export const summaryQuerySchema = z.object({
  period: z.enum(["week", "month"]).default("week"),
  anchor: dateSchema.optional(),
  count: z.coerce.number().int().min(1).max(52).default(8),
});
export type SummaryQuery = z.infer<typeof summaryQuerySchema>;

/** GET /api/history/exercise/[id]?limit=20 */
export const exerciseHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(30),
});
export type ExerciseHistoryQuery = z.infer<typeof exerciseHistoryQuerySchema>;
