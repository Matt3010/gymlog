ALTER TABLE "plans" ADD COLUMN "starts_on" date DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "ends_on" date;