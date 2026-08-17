DROP INDEX "ai_chat_interrupts_threadId_seq_idx";--> statement-breakpoint
DROP INDEX "ai_chat_interrupts_pending_thread_idx";--> statement-breakpoint
DROP INDEX "ai_chat_interrupts_runId_seq_idx";--> statement-breakpoint
DROP INDEX "ai_chat_interrupts_pending_run_idx";--> statement-breakpoint
CREATE INDEX "ai_chat_interrupts_threadId_seq_idx" ON "ai_chat_interrupts" USING btree ("threadId","requestedAt","seq");--> statement-breakpoint
CREATE INDEX "ai_chat_interrupts_pending_thread_idx" ON "ai_chat_interrupts" USING btree ("threadId","requestedAt","seq") WHERE "ai_chat_interrupts"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "ai_chat_interrupts_runId_seq_idx" ON "ai_chat_interrupts" USING btree ("runId","requestedAt","seq");--> statement-breakpoint
CREATE INDEX "ai_chat_interrupts_pending_run_idx" ON "ai_chat_interrupts" USING btree ("runId","requestedAt","seq") WHERE "ai_chat_interrupts"."status" = 'pending';