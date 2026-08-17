CREATE TYPE "public"."AiInterruptStatus" AS ENUM('pending', 'resolved', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."AiRunStatus" AS ENUM('running', 'interrupted', 'completed', 'failed', 'aborted');--> statement-breakpoint
CREATE TYPE "public"."AiThreadKind" AS ENUM('page', 'post', 'template');--> statement-breakpoint
CREATE TABLE "ai_chat_interrupts" (
	"interruptId" text PRIMARY KEY NOT NULL,
	"runId" text NOT NULL,
	"threadId" text NOT NULL,
	"status" "AiInterruptStatus" DEFAULT 'pending' NOT NULL,
	"requestedAt" timestamp (3) NOT NULL,
	"resolvedAt" timestamp (3),
	"payload" jsonb NOT NULL,
	"response" jsonb,
	"seq" bigserial NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_chat_metadata" (
	"namespace" text NOT NULL,
	"key" text NOT NULL,
	"value" jsonb,
	"updatedAt" timestamp (3) NOT NULL,
	CONSTRAINT "ai_chat_metadata_pkey" PRIMARY KEY("namespace","key")
);
--> statement-breakpoint
CREATE TABLE "ai_chat_runs" (
	"runId" text PRIMARY KEY NOT NULL,
	"threadId" text NOT NULL,
	"status" "AiRunStatus" NOT NULL,
	"startedAt" timestamp (3) NOT NULL,
	"finishedAt" timestamp (3),
	"errorMessage" text,
	"errorCode" text,
	"usage" jsonb,
	"sandboxKey" text,
	"detachedSince" timestamp (3),
	"cancelRequested" boolean,
	"driverEpoch" integer
);
--> statement-breakpoint
CREATE TABLE "ai_chat_threads" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantId" text,
	"kind" "AiThreadKind" NOT NULL,
	"contentId" text NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_chat_interrupts" ADD CONSTRAINT "ai_chat_interrupts_runId_ai_chat_runs_runId_fk" FOREIGN KEY ("runId") REFERENCES "public"."ai_chat_runs"("runId") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ai_chat_interrupts" ADD CONSTRAINT "ai_chat_interrupts_threadId_ai_chat_threads_id_fk" FOREIGN KEY ("threadId") REFERENCES "public"."ai_chat_threads"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ai_chat_runs" ADD CONSTRAINT "ai_chat_runs_threadId_ai_chat_threads_id_fk" FOREIGN KEY ("threadId") REFERENCES "public"."ai_chat_threads"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ai_chat_threads" ADD CONSTRAINT "ai_chat_threads_tenantId_tenants_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "ai_chat_interrupts_threadId_seq_idx" ON "ai_chat_interrupts" USING btree ("threadId","seq");--> statement-breakpoint
CREATE INDEX "ai_chat_interrupts_pending_thread_idx" ON "ai_chat_interrupts" USING btree ("threadId","seq") WHERE "ai_chat_interrupts"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "ai_chat_interrupts_runId_seq_idx" ON "ai_chat_interrupts" USING btree ("runId","seq");--> statement-breakpoint
CREATE INDEX "ai_chat_interrupts_pending_run_idx" ON "ai_chat_interrupts" USING btree ("runId","seq") WHERE "ai_chat_interrupts"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "ai_chat_runs_active_idx" ON "ai_chat_runs" USING btree ("threadId","startedAt" DESC NULLS LAST) WHERE "ai_chat_runs"."status" = 'running';--> statement-breakpoint
CREATE INDEX "ai_chat_runs_threadId_startedAt_idx" ON "ai_chat_runs" USING btree ("threadId","startedAt");--> statement-breakpoint
CREATE INDEX "ai_chat_runs_detachedSince_idx" ON "ai_chat_runs" USING btree ("detachedSince") WHERE "ai_chat_runs"."status" = 'running';--> statement-breakpoint
CREATE INDEX "ai_chat_threads_tenantId_idx" ON "ai_chat_threads" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "ai_chat_threads_kind_contentId_idx" ON "ai_chat_threads" USING btree ("kind","contentId");--> statement-breakpoint
CREATE INDEX "ai_chat_threads_updatedAt_idx" ON "ai_chat_threads" USING btree ("updatedAt");