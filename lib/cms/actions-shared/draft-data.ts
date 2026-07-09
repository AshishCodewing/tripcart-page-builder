import { Prisma } from "@/generated/prisma/client"

import { compileCssArtifact } from "@/lib/cms/css-artifacts"

// Build the Prisma update fragment for committing editor state. When `data` is
// present (an editor commit), persist it, clear the pending autosave draft so
// the next load seeds from `data`, and bake the compiled CSS artifact so it
// stays in lockstep with `data` (see lib/cms/css-artifacts.ts); when undefined
// (metadata-only save), leave all of them untouched.
export function buildDraftDataUpdate(data: object | undefined):
  | {
      data: object
      draftData: typeof Prisma.DbNull
      css: string
      cssHash: string
    }
  | Record<string, never> {
  return data !== undefined
    ? { data, draftData: Prisma.DbNull, ...compileCssArtifact(data) }
    : {}
}
