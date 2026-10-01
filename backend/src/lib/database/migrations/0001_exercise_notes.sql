CREATE TABLE "workout_exercise_notes" (
	"workout_id" integer NOT NULL,
	"exercise_id" integer NOT NULL,
	"note" text NOT NULL,
	CONSTRAINT "workout_exercise_notes_workout_id_exercise_id_pk" PRIMARY KEY("workout_id","exercise_id")
);
--> statement-breakpoint
ALTER TABLE "workout_exercise_notes" ADD CONSTRAINT "workout_exercise_notes_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_exercise_notes" ADD CONSTRAINT "workout_exercise_notes_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;