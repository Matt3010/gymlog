-- Each set gets its own reps: "3 sets of 10" becomes {10,10,10}, read before the count goes.
ALTER TABLE "plan_exercises" ALTER COLUMN "reps" SET DATA TYPE text[] USING array_fill("reps", ARRAY["sets"]);--> statement-breakpoint
ALTER TABLE "plan_exercises" DROP COLUMN "sets";
