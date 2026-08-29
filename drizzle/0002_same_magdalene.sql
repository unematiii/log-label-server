CREATE TABLE "email_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"login_code_id" integer NOT NULL,
	"recipient" text NOT NULL,
	"encrypted_code" text NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"last_error" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_jobs" ADD CONSTRAINT "email_jobs_login_code_id_login_codes_id_fk" FOREIGN KEY ("login_code_id") REFERENCES "public"."login_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_jobs_pending_idx" ON "email_jobs" USING btree ("next_attempt_at","attempt_count");