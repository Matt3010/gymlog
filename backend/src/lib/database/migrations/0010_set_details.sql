ALTER TABLE "workout_sets" ALTER COLUMN "reps" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_sets" ALTER COLUMN "weight_kg" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "bodyweight" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD COLUMN "to_failure" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_reps_or_failure" CHECK ("workout_sets"."reps" is not null or "workout_sets"."to_failure");--> statement-breakpoint
-- 0 kg was the only way to say "no weight": it is said now with none
UPDATE "workout_sets" SET "weight_kg" = NULL WHERE "weight_kg" = 0;--> statement-breakpoint
-- an exercise only ever done that way is one done without weights
UPDATE "exercises" e SET "bodyweight" = true
  WHERE EXISTS (SELECT 1 FROM "workout_sets" s WHERE s."exercise_id" = e."id")
    AND NOT EXISTS (SELECT 1 FROM "workout_sets" s WHERE s."exercise_id" = e."id" AND s."weight_kg" IS NOT NULL);
