CREATE TABLE "cardio_entries" (
	"session_id" uuid PRIMARY KEY NOT NULL,
	"activity" text NOT NULL,
	"duration_sec" integer,
	"distance" double precision,
	"distance_unit" text,
	CONSTRAINT "cardio_entries_duration_check" CHECK ("cardio_entries"."duration_sec" is null or "cardio_entries"."duration_sec" >= 0),
	CONSTRAINT "cardio_entries_distance_check" CHECK ("cardio_entries"."distance" is null or "cardio_entries"."distance" >= 0),
	CONSTRAINT "cardio_entries_unit_check" CHECK ("cardio_entries"."distance_unit" is null or "cardio_entries"."distance_unit" in ('mi', 'km'))
);
--> statement-breakpoint
CREATE TABLE "equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"has_weights" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "equipment_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "exercise_equipment" (
	"exercise_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	CONSTRAINT "exercise_equipment_exercise_id_equipment_id_pk" PRIMARY KEY("exercise_id","equipment_id")
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"movement_id" uuid,
	"load_type" text NOT NULL,
	"base_weight" double precision DEFAULT 0 NOT NULL,
	"weight_equipment_id" uuid,
	"increment" double precision DEFAULT 5 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exercises_name_unique" UNIQUE("name"),
	CONSTRAINT "exercises_load_type_check" CHECK ("exercises"."load_type" in ('total', 'per_hand', 'per_side', 'assisted', 'bodyweight')),
	CONSTRAINT "exercises_base_weight_check" CHECK ("exercises"."base_weight" >= 0),
	CONSTRAINT "exercises_increment_check" CHECK ("exercises"."increment" > 0)
);
--> statement-breakpoint
CREATE TABLE "failed_passcode_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier_hash" text NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "location_equipment" (
	"location_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	"weights" double precision[],
	CONSTRAINT "location_equipment_location_id_equipment_id_pk" PRIMARY KEY("location_id","equipment_id")
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "locations_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "movements_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "program_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "program_days_position_check" CHECK ("program_days"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "program_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"movement_id" uuid,
	"exercise_id" uuid,
	"target_sets" integer DEFAULT 3 NOT NULL,
	"rep_min" integer,
	"rep_max" integer,
	"amrap" boolean DEFAULT false NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	CONSTRAINT "program_slots_target_check" CHECK (("program_slots"."movement_id" is not null) <> ("program_slots"."exercise_id" is not null)),
	CONSTRAINT "program_slots_position_check" CHECK ("program_slots"."position" >= 0),
	CONSTRAINT "program_slots_sets_check" CHECK ("program_slots"."target_sets" >= 1),
	CONSTRAINT "program_slots_reps_check" CHECK (("program_slots"."rep_min" is null or "program_slots"."rep_min" >= 0) and ("program_slots"."rep_max" is null or "program_slots"."rep_max" >= 0) and ("program_slots"."rep_min" is null or "program_slots"."rep_max" is null or "program_slots"."rep_min" <= "program_slots"."rep_max"))
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_exercises" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"exercise_id" uuid,
	"slot_id" uuid,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	"load_type" text NOT NULL,
	"base_weight" double precision DEFAULT 0 NOT NULL,
	CONSTRAINT "session_exercises_load_type_check" CHECK ("session_exercises"."load_type" in ('total', 'per_hand', 'per_side', 'assisted', 'bodyweight')),
	CONSTRAINT "session_exercises_base_weight_check" CHECK ("session_exercises"."base_weight" >= 0),
	CONSTRAINT "session_exercises_position_check" CHECK ("session_exercises"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "session_sets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_exercise_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"weight" double precision DEFAULT 0 NOT NULL,
	"reps" integer,
	"done" boolean DEFAULT false NOT NULL,
	"volume" double precision DEFAULT 0 NOT NULL,
	CONSTRAINT "session_sets_position_check" CHECK ("session_sets"."position" >= 0),
	CONSTRAINT "session_sets_weight_check" CHECK ("session_sets"."weight" >= 0),
	CONSTRAINT "session_sets_reps_check" CHECK ("session_sets"."reps" is null or "session_sets"."reps" >= 0),
	CONSTRAINT "session_sets_volume_check" CHECK ("session_sets"."volume" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"kind" text NOT NULL,
	"location_id" uuid,
	"program_id" uuid,
	"program_day_id" uuid,
	"title" text DEFAULT '' NOT NULL,
	"day_name" text DEFAULT '' NOT NULL,
	"bodyweight_lb" double precision DEFAULT 0 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_kind_check" CHECK ("sessions"."kind" in ('strength', 'cardio')),
	CONSTRAINT "sessions_date_check" CHECK ("sessions"."date" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
	CONSTRAINT "sessions_bodyweight_check" CHECK ("sessions"."bodyweight_lb" >= 0)
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"bodyweight_lb" double precision DEFAULT 0 NOT NULL,
	"active_program_id" uuid,
	"last_location_id" uuid,
	CONSTRAINT "settings_singleton_check" CHECK ("settings"."id" = 1),
	CONSTRAINT "settings_bodyweight_check" CHECK ("settings"."bodyweight_lb" >= 0)
);
--> statement-breakpoint
ALTER TABLE "cardio_entries" ADD CONSTRAINT "cardio_entries_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_equipment" ADD CONSTRAINT "exercise_equipment_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_equipment" ADD CONSTRAINT "exercise_equipment_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_movement_id_movements_id_fk" FOREIGN KEY ("movement_id") REFERENCES "public"."movements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_weight_equipment_id_equipment_id_fk" FOREIGN KEY ("weight_equipment_id") REFERENCES "public"."equipment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_equipment" ADD CONSTRAINT "location_equipment_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_equipment" ADD CONSTRAINT "location_equipment_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_days" ADD CONSTRAINT "program_days_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_slots" ADD CONSTRAINT "program_slots_day_id_program_days_id_fk" FOREIGN KEY ("day_id") REFERENCES "public"."program_days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_slots" ADD CONSTRAINT "program_slots_movement_id_movements_id_fk" FOREIGN KEY ("movement_id") REFERENCES "public"."movements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_slots" ADD CONSTRAINT "program_slots_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_exercises" ADD CONSTRAINT "session_exercises_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_exercises" ADD CONSTRAINT "session_exercises_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_exercises" ADD CONSTRAINT "session_exercises_slot_id_program_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."program_slots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_sets" ADD CONSTRAINT "session_sets_session_exercise_id_session_exercises_id_fk" FOREIGN KEY ("session_exercise_id") REFERENCES "public"."session_exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_program_day_id_program_days_id_fk" FOREIGN KEY ("program_day_id") REFERENCES "public"."program_days"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_active_program_id_programs_id_fk" FOREIGN KEY ("active_program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_last_location_id_locations_id_fk" FOREIGN KEY ("last_location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exercise_equipment_equipment_idx" ON "exercise_equipment" USING btree ("equipment_id");--> statement-breakpoint
CREATE INDEX "exercises_movement_idx" ON "exercises" USING btree ("movement_id");--> statement-breakpoint
CREATE INDEX "location_equipment_equipment_idx" ON "location_equipment" USING btree ("equipment_id");--> statement-breakpoint
CREATE INDEX "program_days_program_idx" ON "program_days" USING btree ("program_id","position");--> statement-breakpoint
CREATE INDEX "program_slots_day_idx" ON "program_slots" USING btree ("day_id","position");--> statement-breakpoint
CREATE INDEX "session_exercises_session_idx" ON "session_exercises" USING btree ("session_id","position");--> statement-breakpoint
CREATE INDEX "session_exercises_exercise_idx" ON "session_exercises" USING btree ("exercise_id");--> statement-breakpoint
CREATE INDEX "session_sets_exercise_idx" ON "session_sets" USING btree ("session_exercise_id","position");--> statement-breakpoint
CREATE INDEX "sessions_date_idx" ON "sessions" USING btree ("date");--> statement-breakpoint
CREATE INDEX "sessions_program_idx" ON "sessions" USING btree ("program_id","started_at");