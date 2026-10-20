-- A plan is one workout: every day of a plan becomes a plan of its own, named
-- "Plan · Day" (just "Plan" when it had one day), with the plan's notes. Its
-- exercises and the workouts that followed it go with it; the old plans go.
ALTER TABLE "plans" ADD COLUMN "from_day" integer;--> statement-breakpoint
INSERT INTO "plans" ("user_id", "name", "notes", "from_day")
  SELECT p."user_id",
         CASE WHEN (SELECT count(*) FROM "plan_days" o WHERE o."plan_id" = p."id") = 1 THEN p."name" ELSE p."name" || ' · ' || d."name" END,
         p."notes", d."id"
  FROM "plan_days" d JOIN "plans" p ON p."id" = d."plan_id"
  ORDER BY p."id", d."position";--> statement-breakpoint
ALTER TABLE "plan_exercises" ADD COLUMN "plan_id" integer;--> statement-breakpoint
UPDATE "plan_exercises" e SET "plan_id" = p."id" FROM "plans" p WHERE p."from_day" = e."plan_day_id";--> statement-breakpoint
ALTER TABLE "workouts" ADD COLUMN "plan_id" integer;--> statement-breakpoint
UPDATE "workouts" w SET "plan_id" = p."id" FROM "plans" p WHERE p."from_day" = w."plan_day_id";--> statement-breakpoint
-- the history keeps the names it had, in one: the plan's and the day's
UPDATE "workouts" w SET "plan_name" = w."plan_name" || ' · ' || w."day_name"
  WHERE w."day_name" IS NOT NULL AND w."plan_name" IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM "plans" p WHERE p."id" = w."plan_id" AND p."name" = w."plan_name");--> statement-breakpoint
ALTER TABLE "plan_exercises" DROP COLUMN "plan_day_id";--> statement-breakpoint
ALTER TABLE "workouts" DROP COLUMN "plan_day_id";--> statement-breakpoint
ALTER TABLE "workouts" DROP COLUMN "day_name";--> statement-breakpoint
DELETE FROM "plans" WHERE "from_day" IS NULL;--> statement-breakpoint
DROP TABLE "plan_days";--> statement-breakpoint
ALTER TABLE "plans" DROP COLUMN "from_day";--> statement-breakpoint
ALTER TABLE "plans" DROP COLUMN "starts_on";--> statement-breakpoint
ALTER TABLE "plans" DROP COLUMN "ends_on";--> statement-breakpoint
ALTER TABLE "plans" DROP COLUMN "archived";--> statement-breakpoint
ALTER TABLE "plan_exercises" ALTER COLUMN "plan_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "plan_exercises" ADD CONSTRAINT "plan_exercises_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plan_exercises_plan" ON "plan_exercises" USING btree ("plan_id");
