import { z } from "zod";
import { DISTANCE_UNITS, LOAD_TYPES } from "@/types/domain";

export const idSchema = z.uuid();
export const nameSchema = z.string().trim().min(1).max(80);
/** A weight in pounds as entered by the owner. */
export const weightSchema = z.number().finite().min(0).max(2000);

export const loadTypeSchema = z.enum(LOAD_TYPES);
export const distanceUnitSchema = z.enum(DISTANCE_UNITS);

/** POST /api/equipment, PUT /api/equipment/[id] */
export const equipmentInputSchema = z.object({
  name: nameSchema,
  hasWeights: z.boolean().default(false),
});
export type EquipmentInput = z.infer<typeof equipmentInputSchema>;

/** Body for archive/restore of locations, exercises and programs. */
export const archiveInputSchema = z.object({ archived: z.boolean() });
export type ArchiveInput = z.infer<typeof archiveInputSchema>;

const locationEquipmentInputSchema = z.object({
  equipmentId: idSchema,
  /** null = not applicable or "any". Ascending, de-duplicated by the server. */
  weights: z.array(weightSchema).max(1000).nullable().default(null),
});

/** POST /api/locations, PUT /api/locations/[id] (replaces the equipment list) */
export const locationInputSchema = z.object({
  name: nameSchema,
  equipment: z
    .array(locationEquipmentInputSchema)
    .max(200)
    .refine(
      (items) =>
        new Set(items.map((item) => item.equipmentId)).size === items.length,
      "Equipment can only be listed once per location.",
    )
    .default([]),
});
export type LocationInput = z.infer<typeof locationInputSchema>;

/** POST /api/movements, PUT /api/movements/[id] */
export const movementInputSchema = z.object({ name: nameSchema });
export type MovementInput = z.infer<typeof movementInputSchema>;

/** POST /api/exercises, PUT /api/exercises/[id] */
export const exerciseInputSchema = z
  .object({
    name: nameSchema,
    movementId: idSchema.nullable().default(null),
    loadType: loadTypeSchema,
    baseWeight: weightSchema.default(0),
    weightEquipmentId: idSchema.nullable().default(null),
    increment: z.number().finite().gt(0).max(500).default(5),
    equipmentIds: z
      .array(idSchema)
      .max(50)
      .refine((ids) => new Set(ids).size === ids.length, "Duplicate equipment.")
      .default([]),
  })
  .refine(
    (value) =>
      value.weightEquipmentId === null ||
      value.equipmentIds.includes(value.weightEquipmentId),
    {
      path: ["weightEquipmentId"],
      message: "Weight equipment must be one of the required equipment.",
    },
  );
export type ExerciseInput = z.infer<typeof exerciseInputSchema>;

/** PUT /api/settings (partial update of the singleton row) */
export const settingsInputSchema = z
  .object({
    bodyweightLb: weightSchema,
    activeProgramId: idSchema.nullable(),
    lastLocationId: idSchema.nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Nothing to update.");
export type SettingsInput = z.infer<typeof settingsInputSchema>;
