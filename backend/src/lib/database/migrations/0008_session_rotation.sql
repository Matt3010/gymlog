ALTER TABLE "sessions" ADD COLUMN "family" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "rotated_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "sessions_family" ON "sessions" USING btree ("family");