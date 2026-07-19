import { compileCssArtifact } from "@/lib/cms/css-artifacts"

// Build the Drizzle `.set()` fragment for committing editor state. When `data`
// is present (an editor commit), persist it, clear the pending autosave draft
// so the next load seeds from `data`, and bake the compiled CSS artifact so it
// stays in lockstep with `data` (see lib/cms/css-artifacts.ts); when undefined
// (metadata-only save), leave all of them untouched.
//
// `draftData: null` writes SQL NULL — under Prisma this was `Prisma.DbNull`;
// Drizzle has no JSON-null vs DB-null distinction, so plain `null` is correct.
export function buildDraftDataUpdate(data: object | undefined):
  | {
      data: object
      draftData: null
      css: string
      cssHash: string
    }
  | Record<string, never> {
  return data !== undefined
    ? { data, draftData: null, ...compileCssArtifact(data) }
    : {}
}
