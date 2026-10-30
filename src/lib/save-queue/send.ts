import { apiDelete, apiPatch, apiPost, apiPut } from "@/lib/api";
import type { Mutation } from "./types";

const base = (sessionId: string) => `/api/sessions/${sessionId}`;

/** Sends one mutation to its endpoint. Throws `ApiError` on failure. */
export async function sendMutation(mutation: Mutation): Promise<void> {
  switch (mutation.type) {
    case "putSet":
      await apiPut(
        `${base(mutation.sessionId)}/exercises/${mutation.exerciseId}/sets/${mutation.set.id}`,
        mutation.set,
      );
      return;
    case "deleteSet":
      await apiDelete(
        `${base(mutation.sessionId)}/exercises/${mutation.exerciseId}/sets/${mutation.setId}`,
      );
      return;
    case "putExercise":
      await apiPut(
        `${base(mutation.sessionId)}/exercises/${mutation.exercise.id}`,
        mutation.exercise,
      );
      return;
    case "deleteExercise":
      await apiDelete(
        `${base(mutation.sessionId)}/exercises/${mutation.exerciseId}`,
      );
      return;
    case "patchSession":
      await apiPatch(base(mutation.sessionId), mutation.patch);
      return;
    case "finish":
      await apiPost(`${base(mutation.sessionId)}/finish`, {
        finishedAt: mutation.finishedAt,
      });
      return;
    case "reopen":
      await apiPost(`${base(mutation.sessionId)}/reopen`);
      return;
  }
}
