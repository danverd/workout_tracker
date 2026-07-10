import type { WorkoutPayload } from "@/types/workout";

type SummaryPeriod = "week" | "month";

export interface WorkoutSummary {
  start: string;
  end: string;
  totalVolume: number;
  workouts: Array<{ date: string; templateName: string; volume: number }>;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`Request failed (${response.status}).`);
  return response.json() as Promise<T>;
}

const jsonRequest = (method: "POST" | "PUT", body: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const workoutApi = {
  login: (passcode: string) =>
    request<{ ok: true }>("/api/session", jsonRequest("POST", { passcode })),
  getWorkout: async (date: string) =>
    request<{ workout: WorkoutPayload | null }>(`/api/workouts/${date}`),
  createWorkout: (date: string, templateSlug: string) =>
    request<WorkoutPayload>(
      "/api/workouts",
      jsonRequest("POST", { date, templateSlug }),
    ),
  saveWorkout: (workout: WorkoutPayload) =>
    request<WorkoutPayload>(
      `/api/workouts/${workout.date}`,
      jsonRequest("PUT", workout),
    ),
  finishWorkout: (date: string) =>
    request<{ ok: true }>(`/api/workouts/${date}/finish`, { method: "POST" }),
  getExerciseDefaults: (slug: string, date: string) =>
    request<{ weights: number[] }>(
      `/api/exercises/${slug}/defaults?date=${date}`,
    ),
  getSummary: (period: SummaryPeriod, anchor: string) =>
    request<WorkoutSummary>(`/api/summaries?period=${period}&anchor=${anchor}`),
  logout: () => request<{ ok: true }>("/api/session", { method: "DELETE" }),
};
