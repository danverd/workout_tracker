import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

export const equipment = pgTable("equipment", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  hasWeights: boolean("has_weights").notNull().default(false),
  createdAt: createdAt(),
});

export const locations = pgTable("locations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const locationEquipment = pgTable(
  "location_equipment",
  {
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    equipmentId: uuid("equipment_id")
      .notNull()
      .references(() => equipment.id, { onDelete: "cascade" }),
    // Available weights at this location; null = not applicable or "any".
    weights: doublePrecision("weights").array(),
  },
  (t) => [
    primaryKey({ columns: [t.locationId, t.equipmentId] }),
    index("location_equipment_equipment_idx").on(t.equipmentId),
  ],
);

export const movements = pgTable("movements", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: createdAt(),
});

export const exercises = pgTable(
  "exercises",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull().unique(),
    movementId: uuid("movement_id").references(() => movements.id, {
      onDelete: "set null",
    }),
    loadType: text("load_type").notNull(),
    baseWeight: doublePrecision("base_weight").notNull().default(0),
    // Which required equipment's weight list drives snapping and stepper chips.
    weightEquipmentId: uuid("weight_equipment_id").references(
      () => equipment.id,
      { onDelete: "set null" },
    ),
    increment: doublePrecision("increment").notNull().default(5),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      "exercises_load_type_check",
      sql`${t.loadType} in ('total', 'per_hand', 'per_side', 'assisted', 'bodyweight')`,
    ),
    check("exercises_base_weight_check", sql`${t.baseWeight} >= 0`),
    check("exercises_increment_check", sql`${t.increment} > 0`),
    index("exercises_movement_idx").on(t.movementId),
  ],
);

export const exerciseEquipment = pgTable(
  "exercise_equipment",
  {
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    equipmentId: uuid("equipment_id")
      .notNull()
      .references(() => equipment.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.exerciseId, t.equipmentId] }),
    index("exercise_equipment_equipment_idx").on(t.equipmentId),
  ],
);

export const programs = pgTable("programs", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const programDays = pgTable(
  "program_days",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    programId: uuid("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull(),
  },
  (t) => [
    check("program_days_position_check", sql`${t.position} >= 0`),
    index("program_days_program_idx").on(t.programId, t.position),
  ],
);

export const programSlots = pgTable(
  "program_slots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dayId: uuid("day_id")
      .notNull()
      .references(() => programDays.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    movementId: uuid("movement_id").references(() => movements.id, {
      onDelete: "cascade",
    }),
    exerciseId: uuid("exercise_id").references(() => exercises.id, {
      onDelete: "cascade",
    }),
    targetSets: integer("target_sets").notNull().default(3),
    repMin: integer("rep_min"),
    repMax: integer("rep_max"),
    amrap: boolean("amrap").notNull().default(false),
    notes: text("notes").notNull().default(""),
  },
  (t) => [
    check(
      "program_slots_target_check",
      sql`(${t.movementId} is not null) <> (${t.exerciseId} is not null)`,
    ),
    check("program_slots_position_check", sql`${t.position} >= 0`),
    check("program_slots_sets_check", sql`${t.targetSets} >= 1`),
    check(
      "program_slots_reps_check",
      sql`(${t.repMin} is null or ${t.repMin} >= 0) and (${t.repMax} is null or ${t.repMax} >= 0) and (${t.repMin} is null or ${t.repMax} is null or ${t.repMin} <= ${t.repMax})`,
    ),
    index("program_slots_day_idx").on(t.dayId, t.position),
  ],
);

// Ids of sessions, session_exercises and session_sets are generated by the
// client (idempotent upserts), so none of them rely on a database default.
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey(),
    date: text("date").notNull(),
    kind: text("kind").notNull(),
    locationId: uuid("location_id").references(() => locations.id, {
      onDelete: "set null",
    }),
    programId: uuid("program_id").references(() => programs.id, {
      onDelete: "set null",
    }),
    programDayId: uuid("program_day_id").references(() => programDays.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull().default(""),
    dayName: text("day_name").notNull().default(""),
    bodyweightLb: doublePrecision("bodyweight_lb").notNull().default(0),
    notes: text("notes").notNull().default(""),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    check("sessions_kind_check", sql`${t.kind} in ('strength', 'cardio')`),
    check(
      "sessions_date_check",
      sql`${t.date} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'`,
    ),
    check("sessions_bodyweight_check", sql`${t.bodyweightLb} >= 0`),
    index("sessions_date_idx").on(t.date),
    index("sessions_program_idx").on(t.programId, t.startedAt),
  ],
);

export const sessionExercises = pgTable(
  "session_exercises",
  {
    id: uuid("id").primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id").references(() => exercises.id, {
      onDelete: "set null",
    }),
    slotId: uuid("slot_id").references(() => programSlots.id, {
      onDelete: "set null",
    }),
    position: integer("position").notNull(),
    // Snapshots keep history correct when the exercise is edited later.
    name: text("name").notNull(),
    loadType: text("load_type").notNull(),
    baseWeight: doublePrecision("base_weight").notNull().default(0),
  },
  (t) => [
    check(
      "session_exercises_load_type_check",
      sql`${t.loadType} in ('total', 'per_hand', 'per_side', 'assisted', 'bodyweight')`,
    ),
    check("session_exercises_base_weight_check", sql`${t.baseWeight} >= 0`),
    check("session_exercises_position_check", sql`${t.position} >= 0`),
    index("session_exercises_session_idx").on(t.sessionId, t.position),
    index("session_exercises_exercise_idx").on(t.exerciseId),
  ],
);

export const sessionSets = pgTable(
  "session_sets",
  {
    id: uuid("id").primaryKey(),
    sessionExerciseId: uuid("session_exercise_id")
      .notNull()
      .references(() => sessionExercises.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    weight: doublePrecision("weight").notNull().default(0),
    reps: integer("reps"),
    done: boolean("done").notNull().default(false),
    // Computed on the server on every save; the client never sends it.
    volume: doublePrecision("volume").notNull().default(0),
  },
  (t) => [
    check("session_sets_position_check", sql`${t.position} >= 0`),
    check("session_sets_weight_check", sql`${t.weight} >= 0`),
    check("session_sets_reps_check", sql`${t.reps} is null or ${t.reps} >= 0`),
    check("session_sets_volume_check", sql`${t.volume} >= 0`),
    index("session_sets_exercise_idx").on(t.sessionExerciseId, t.position),
  ],
);

export const cardioEntries = pgTable(
  "cardio_entries",
  {
    sessionId: uuid("session_id")
      .primaryKey()
      .references(() => sessions.id, { onDelete: "cascade" }),
    activity: text("activity").notNull(),
    durationSec: integer("duration_sec"),
    distance: doublePrecision("distance"),
    distanceUnit: text("distance_unit"),
  },
  (t) => [
    check(
      "cardio_entries_duration_check",
      sql`${t.durationSec} is null or ${t.durationSec} >= 0`,
    ),
    check(
      "cardio_entries_distance_check",
      sql`${t.distance} is null or ${t.distance} >= 0`,
    ),
    check(
      "cardio_entries_unit_check",
      sql`${t.distanceUnit} is null or ${t.distanceUnit} in ('mi', 'km')`,
    ),
  ],
);

export const settings = pgTable(
  "settings",
  {
    id: integer("id").primaryKey().default(1),
    bodyweightLb: doublePrecision("bodyweight_lb").notNull().default(0),
    activeProgramId: uuid("active_program_id").references(() => programs.id, {
      onDelete: "set null",
    }),
    lastLocationId: uuid("last_location_id").references(() => locations.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    check("settings_singleton_check", sql`${t.id} = 1`),
    check("settings_bodyweight_check", sql`${t.bodyweightLb} >= 0`),
  ],
);

export const failedPasscodeAttempts = pgTable("failed_passcode_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  identifierHash: text("identifier_hash").notNull(),
  attemptedAt: timestamp("attempted_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
