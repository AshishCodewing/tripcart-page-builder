ALTER TABLE "doc_chunks" ADD COLUMN "source" text DEFAULT 'grapesjs' NOT NULL;--> statement-breakpoint
CREATE INDEX "doc_chunks_source_idx" ON "doc_chunks" USING btree ("source");