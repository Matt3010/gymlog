ALTER TABLE "workout_sets" ADD COLUMN "client_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "workout_sets_client_key" ON "workout_sets" USING btree ("workout_id","client_key");