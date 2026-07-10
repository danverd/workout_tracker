import { z } from "zod";
import { isDateOnly } from "@/lib/dates";

const date = z.string().refine(isDateOnly, { message: "Invalid date." });
const target = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("reps"),
    reps: z.number().int().min(0).max(1_000),
  }),
  z.object({ kind: z.literal("amrap") }),
]);
const cardio = z
  .object({
    position: z.number().int().min(1),
    kind: z.enum(["treadmill", "rowing", "stairmaster"]),
    incline: z.number().min(0).max(100).nullable(),
    speed: z.number().min(0).max(100).nullable(),
    duration: z
      .string()
      .regex(/^\d{2}:[0-5]\d:[0-5]\d$/)
      .nullable(),
    pace: z
      .string()
      .regex(/^\d{2}:[0-5]\d$/)
      .nullable(),
  })
  .superRefine((item, ctx) => {
    if (
      item.kind === "treadmill" &&
      (item.incline === null || item.speed === null || item.duration === null)
    )
      ctx.addIssue({
        code: "custom",
        message: "Treadmill requires incline, speed, and duration.",
      });
    if (
      item.kind === "rowing" &&
      (item.duration === null || item.pace === null)
    )
      ctx.addIssue({
        code: "custom",
        message: "Rowing requires duration and pace.",
      });
    if (
      item.kind === "stairmaster" &&
      (item.speed === null || item.duration === null)
    )
      ctx.addIssue({
        code: "custom",
        message: "StairMaster requires speed and duration.",
      });
  });

export const createWorkoutSchema = z.object({
  date,
  templateSlug: z.string().min(1).max(80),
});
export const workoutSchema = z
  .object({
    date,
    templateSlug: z.string().min(1).max(80),
    templateName: z.string().min(1).max(120),
    status: z.enum(["in_progress", "finished"]),
    exercises: z
      .array(
        z.object({
          position: z.number().int().min(1),
          exerciseSlug: z.string().min(1).max(120),
          name: z.string().min(1).max(160),
          inputMode: z.enum([
            "stack",
            "one_side_plates",
            "per_dumbbell",
            "per_hand",
            "per_arm",
            "machine_assistance",
            "bodyweight",
            "kettlebell",
          ]),
          effectiveWeightRule: z.enum([
            "stack",
            "leg_press",
            "super_squats",
            "barbell",
            "dumbbell",
            "assisted",
            "cable_per_hand",
            "cable_per_arm",
            "bodyweight",
            "kettlebell",
          ]),
          sets: z
            .array(
              z.object({
                position: z.number().int().min(1),
                target,
                actualReps: z.number().int().min(0).max(1_000).nullable(),
                inputWeight: z.number().min(0).max(10_000),
              }),
            )
            .min(1)
            .max(30),
        }),
      )
      .max(50),
    cardioActivities: z.array(cardio).max(20),
  })
  .superRefine((value, ctx) => {
    if (value.exercises.length && value.cardioActivities.length)
      ctx.addIssue({
        code: "custom",
        message: "A workout cannot mix lifting and cardio.",
      });
  });

export const summaryQuerySchema = z.object({
  period: z.enum(["week", "month"]),
  anchor: date,
});
