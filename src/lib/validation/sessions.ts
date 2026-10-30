import { z } from "zod";
import { isDateOnly } from "@/lib/dates";
import {
  distanceUnitSchema,
  idSchema,
  weightSchema,
} from "@/lib/validation/setup";

export const dateSchema = z.string().refine(isDateOnly, "Use YYYY-MM-DD.");
const timestampSchema = z.iso.datetime({ offset: true });
const notesSchema = z.string().trim().max(2000);
const titleSchema = z.string().trim().max(120);

/**
 * Set payload. The client never sends volume or snapshots: the server
 * computes volume from the session exercise snapshot and session bodyweight.
 */
export const sessionSetInputSchema = z.object({
  id: idSchema,
  position: z.number().int().min(0).max(200),
  weight: weightSchema.default(0),
  reps: z.number().int().min(0).max(1000).nullable().default(null),
  done: z.boolean().default(false),
});
export type SessionSetInput = z.infer<typeof sessionSetInputSchema>;

/**
 * PUT /api/sessions/[id]/exercises/[exerciseId]. The server snapshots name,
 * load type and base weight from exerciseId when the row is first created.
 */
export const sessionExerciseInputSchema = z.object({
  id: idSchema,
  exerciseId: idSchema,
  slotId: idSchema.nullable().default(null),
  position: z.number().int().min(0).max(100),
});
export type SessionExerciseInput = z.infer<typeof sessionExerciseInputSchema>;

/** Exercise plus its initial sets, as sent when a session is created. */
export const sessionExerciseWithSetsSchema = sessionExerciseInputSchema.extend({
  sets: z.array(sessionSetInputSchema).max(60).default([]),
});
export type SessionExerciseWithSets = z.infer<
  typeof sessionExerciseWithSetsSchema
>;

/**
 * PUT /api/sessions/[id]: idempotent upsert of a strength session with its
 * exercises and sets. Existing sessions keep their snapshots and bodyweight.
 * `date` defaults to today in the app time zone; bodyweight is snapshotted
 * from settings by the server.
 */
export const sessionCreateSchema = z.object({
  id: idSchema,
  date: dateSchema.optional(),
  locationId: idSchema.nullable().default(null),
  programId: idSchema.nullable().default(null),
  programDayId: idSchema.nullable().default(null),
  title: titleSchema.default(""),
  dayName: titleSchema.default(""),
  notes: notesSchema.default(""),
  startedAt: timestampSchema.optional(),
  exercises: z
    .array(sessionExerciseWithSetsSchema)
    .max(60)
    .default([])
    .refine(
      (items) => new Set(items.map((item) => item.id)).size === items.length,
      "Duplicate session exercise ids.",
    ),
});
export type SessionCreateInput = z.infer<typeof sessionCreateSchema>;

/** PATCH /api/sessions/[id]: header fields, including the location. */
export const sessionPatchSchema = z
  .object({
    locationId: idSchema.nullable(),
    title: titleSchema,
    notes: notesSchema,
    date: dateSchema,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Nothing to update.");
export type SessionPatchInput = z.infer<typeof sessionPatchSchema>;

/** POST /api/sessions/[id]/finish (finishedAt defaults to now). */
export const sessionFinishSchema = z.object({
  finishedAt: timestampSchema.optional(),
});
export type SessionFinishInput = z.infer<typeof sessionFinishSchema>;

/** POST /api/sessions/[id]/reopen (no fields). */
export const sessionReopenSchema = z.object({});
export type SessionReopenInput = z.infer<typeof sessionReopenSchema>;

/** PUT /api/cardio/[id]: idempotent create/update of a cardio session. */
export const cardioInputSchema = z.object({
  id: idSchema,
  date: dateSchema.optional(),
  locationId: idSchema.nullable().default(null),
  activity: z.string().trim().min(1).max(80),
  durationSec: z.number().int().min(0).max(86_400).nullable().default(null),
  distance: z.number().finite().min(0).max(10_000).nullable().default(null),
  distanceUnit: distanceUnitSchema.nullable().default(null),
  notes: notesSchema.default(""),
  startedAt: timestampSchema.optional(),
});
export type CardioInput = z.infer<typeof cardioInputSchema>;
