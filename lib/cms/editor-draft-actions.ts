"use server"

import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { pages, posts, templates } from "@/lib/schema"

import { validateProjectPayload } from "./project-payload"
import { slimTemplateProject } from "./templates"

/**
 * Persist the editor's in-progress state to the `draftData` column.
 *
 * Called by the `tc-remote` storage adapter on every (debounced) autosave
 * from the canvas. Drafts are isolated from the published `data` the
 * public/preview render reads — the explicit Save/Publish path copies the
 * committed state into `data` and clears `draftData` (see save{Page,Post,
 * Template}). Because a draft never affects a rendered surface, there is
 * nothing to cache-invalidate here.
 *
 * `project` is the full editor `ProjectDefinition`, already
 * protected-style-filtered on the client (see `tcRemoteStorage`). Pages
 * and posts store it verbatim; templates store the slim
 * `{ component, styles }` shape (same as `data`).
 *
 * TODO(auth): admin mutations are currently unguarded repo-wide. When auth
 * lands, gate this on the caller owning the tenant that owns `id`.
 *
 * The payload is structurally validated (`validateProjectPayload`) before
 * any write — same boundary rule as the explicit save actions.
 */
type EditorKind = "page" | "post" | "template"

export async function saveEditorDraft(
  kind: EditorKind,
  id: string,
  project: unknown
): Promise<void> {
  const validated = validateProjectPayload(project)
  switch (kind) {
    case "template": {
      const draftData = slimTemplateProject(validated)
      await db
        .update(templates)
        .set({ draftData: draftData as object })
        .where(eq(templates.id, id))
      return
    }
    case "page":
      await db
        .update(pages)
        .set({ draftData: validated })
        .where(eq(pages.id, id))
      return
    case "post":
      await db
        .update(posts)
        .set({ draftData: validated })
        .where(eq(posts.id, id))
      return
    default: {
      // Exhaustiveness guard — a new EditorKind must wire its own
      // persistence here; the `never` assignment turns a grown union into
      // a compile error, the throw is the runtime backstop.
      const unreachable: never = kind
      throw new Error(`Unknown editor kind: ${String(unreachable)}`)
    }
  }
}
