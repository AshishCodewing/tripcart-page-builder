import { Prisma } from "@/generated/prisma/client"

// Build the Prisma update fragment for committing editor state. When `data` is
// present (an editor commit), persist it and clear the pending autosave draft
// so the next load seeds from `data`; when undefined (metadata-only save),
// leave both untouched.
export function buildDraftDataUpdate(
  data: object | undefined
): { data: object; draftData: typeof Prisma.DbNull } | Record<string, never> {
  return data !== undefined ? { data, draftData: Prisma.DbNull } : {}
}
