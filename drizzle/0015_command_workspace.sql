CREATE TABLE "command_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_slug" text NOT NULL,
	"kind" text NOT NULL,
	"record_key" text NOT NULL,
	"status" text DEFAULT 'saved' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"next_run_at" timestamp,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "command_record_key" ON "command_records" USING btree ("site_slug","kind","record_key");--> statement-breakpoint
CREATE INDEX "command_site_kind" ON "command_records" USING btree ("site_slug","kind","created_at");--> statement-breakpoint
CREATE INDEX "command_record_due" ON "command_records" USING btree ("kind","status","next_run_at");