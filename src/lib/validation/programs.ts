import { z } from "zod";
import { idSchema, nameSchema } from "@/lib/validation/setup";

const repsSchema = z.number().int().min(0).max(1000);

/** Most days a program can have. */
export const MAX_DAYS = 14;

/** One slot: exactly one of movementId / exerciseId. Order = array order. */
export const programSlotInputSchema = z
  .object({
    /** Omit for a new slot; keep for existing slots so history links hold. */
    id: idSchema.optional(),
    movementId: idSchema.nullable().default(null),
    exerciseId: idSchema.nullable().default(null),
    targetSets: z.number().int().min(1).max(30).default(3),
    repMin: repsSchema.nullable().default(null),
    repMax: repsSchema.nullable().default(null),
    amrap: z.boolean().default(false),
    notes: z.string().trim().max(500).default(""),
  })
  .refine((slot) => (slot.movementId === null) !== (slot.exerciseId === null), {
    path: ["movementId"],
    message: "Choose either a movement or a specific exercise.",
  })
  .refine(
    (slot) =>
      slot.repMin === null ||
      slot.repMax === null ||
      slot.repMin <= slot.repMax,
    { path: ["repMax"], message: "Max reps must be at least min reps." },
  );
export type ProgramSlotInput = z.infer<typeof programSlotInputSchema>;

export const programDayInputSchema = z.object({
  id: idSchema.optional(),
  name: nameSchema,
  slots: z.array(programSlotInputSchema).max(40).default([]),
});
export type ProgramDayInput = z.infer<typeof programDayInputSchema>;

/**
 * POST /api/programs (create) and PUT /api/programs/[id] (replace whole
 * program in one transaction). Days and slots are ordered by array position.
 */
export const programSaveSchema = z.object({
  name: nameSchema,
  days: z.array(programDayInputSchema).max(MAX_DAYS).default([]),
});
export type ProgramSaveInput = z.infer<typeof programSaveSchema>;
