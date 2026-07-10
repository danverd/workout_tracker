import {
  doublePrecision,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
export const workoutStatus = pgEnum("workout_status", [
  "in_progress",
  "finished",
]);
export const exercises = pgTable("exercises", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  inputMode: text("input_mode").notNull(),
  effectiveWeightRule: text("effective_weight_rule").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const workoutTemplates = pgTable("workout_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const templateExercises = pgTable(
  "template_exercises",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => workoutTemplates.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id),
    position: integer("position").notNull(),
  },
  (t) => [
    uniqueIndex("template_exercise_position_unique").on(
      t.templateId,
      t.position,
    ),
  ],
);
export const templateSets = pgTable(
  "template_sets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    templateExerciseId: uuid("template_exercise_id")
      .notNull()
      .references(() => templateExercises.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    targetKind: text("target_kind").notNull(),
    targetReps: integer("target_reps"),
    baselineInputWeight: doublePrecision("baseline_input_weight").notNull(),
  },
  (t) => [
    uniqueIndex("template_set_position_unique").on(
      t.templateExerciseId,
      t.position,
    ),
  ],
);
export const workoutInstances = pgTable(
  "workout_instances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workoutDate: text("workout_date").notNull(),
    templateId: uuid("template_id").references(() => workoutTemplates.id),
    templateSlug: text("template_slug").notNull(),
    templateName: text("template_name").notNull(),
    status: workoutStatus("status").notNull().default("in_progress"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [uniqueIndex("workout_date_unique").on(t.workoutDate)],
);
export const workoutExercises = pgTable(
  "workout_exercises",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workoutId: uuid("workout_id")
      .notNull()
      .references(() => workoutInstances.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id").references(() => exercises.id),
    exerciseSlug: text("exercise_slug").notNull(),
    name: text("name").notNull(),
    inputMode: text("input_mode").notNull(),
    effectiveWeightRule: text("effective_weight_rule").notNull(),
    position: integer("position").notNull(),
  },
  (t) => [
    uniqueIndex("workout_exercise_position_unique").on(t.workoutId, t.position),
  ],
);
export const workoutSets = pgTable(
  "workout_sets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workoutExerciseId: uuid("workout_exercise_id")
      .notNull()
      .references(() => workoutExercises.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    targetKind: text("target_kind").notNull(),
    targetReps: integer("target_reps"),
    actualReps: integer("actual_reps"),
    inputWeight: doublePrecision("input_weight").notNull(),
    effectiveWeight: doublePrecision("effective_weight").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("workout_set_position_unique").on(
      t.workoutExerciseId,
      t.position,
    ),
  ],
);
export const cardioActivities = pgTable(
  "cardio_activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workoutId: uuid("workout_id")
      .notNull()
      .references(() => workoutInstances.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    kind: text("kind").notNull(),
    incline: doublePrecision("incline"),
    speed: doublePrecision("speed"),
    duration: text("duration"),
    pace: text("pace"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("cardio_activity_position_unique").on(t.workoutId, t.position),
  ],
);
export const failedPasscodeAttempts = pgTable("failed_passcode_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  identifierHash: text("identifier_hash").notNull(),
  attemptedAt: timestamp("attempted_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
