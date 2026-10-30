DROP INDEX "sessions_date_idx";--> statement-breakpoint
CREATE INDEX "failed_passcode_attempts_identifier_idx" ON "failed_passcode_attempts" USING btree ("identifier_hash","attempted_at");--> statement-breakpoint
CREATE INDEX "session_sets_done_idx" ON "session_sets" USING btree ("session_exercise_id") WHERE "session_sets"."done";--> statement-breakpoint
CREATE INDEX "sessions_date_idx" ON "sessions" USING btree ("date","started_at");