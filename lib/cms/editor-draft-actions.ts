"use server"

import { prisma } from "@/lib/prisma"

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
 */
type EditorKind = "page" | "post" | "template"

export async function saveEditorDraft(
  kind: EditorKind,
  id: string,
  project: unknown
): Promise<void> {
  switch (kind) {
    case "template": {
      const draftData = slimTemplateProject(project)
      await prisma.template.update({
        where: { id },
        data: { draftData: draftData as object },
      })
      return
    }
    case "page":
      await prisma.page.update({
        where: { id },
        data: { draftData: project as object },
      })
      return
    case "post":
      await prisma.post.update({
        where: { id },
        data: { draftData: project as object },
      })
      return
  }
}
