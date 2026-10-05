CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"kind" text NOT NULL,
	"white_id" text,
	"black_id" text,
	"initial_seconds" integer,
	"increment_seconds" integer,
	"result" text NOT NULL,
	"reason" text NOT NULL,
	"moves" text NOT NULL,
	"final_position" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_white_id_user_id_fk" FOREIGN KEY ("white_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_black_id_user_id_fk" FOREIGN KEY ("black_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "games_white_id_idx" ON "games" USING btree ("white_id","ended_at");--> statement-breakpoint
CREATE INDEX "games_black_id_idx" ON "games" USING btree ("black_id","ended_at");