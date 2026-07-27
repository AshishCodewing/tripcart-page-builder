// Client tool handlers for the copilot (plan 017). Instantiated in chat.tsx
// with access to the GrapesJS editor; joins the client bundle via its
// importer. Code tools call /api/generate (the strong code-gen model) and
// apply the returned HTML to the canvas — only a small {success, summary}
// result flows back into the orchestrator loop.
import type { Editor } from "grapesjs"
import type { CodegenPosition, CodegenRequest } from "@/lib/ai/codegen"
import {
  addComponentTool,
  editComponentTool,
  generatePageTool,
  moveComponentTool,
  removeComponentTool,
} from "@/lib/ai/tools"
import { applyGenerated } from "@/lib/page-builder/apply-generated"
import { streamGenerate } from "@/lib/page-builder/stream-generate"
import { clearPreview, renderPreview } from "@/lib/page-builder/stream-preview"

type ToolResult = { success: boolean; summary: string }

async function callGenerate(body: CodegenRequest): Promise<{ html: string }> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as {
    html?: string
    error?: string
  }
  if (!res.ok || !data.html) {
    throw new Error(data.error ?? `Code generation failed (HTTP ${res.status})`)
  }
  return { html: data.html }
}

/** Fresh page snapshot for the code-gen model, read at tool-execution time
 * (post-approval) so CURRENT_CODE can't go stale mid-turn. */
function editorSnapshot(editor: Editor) {
  return {
    pageHtml: editor.getWrapper()?.toHTML(),
    pageCss: editor.getCss(),
    devices: editor.Devices.getDevices().map((d) => ({
      name: d.getName(),
      width: d.get("width") as string | undefined,
      widthMedia: d.get("widthMedia") as string | undefined,
    })),
  }
}

function findById(editor: Editor, id: string) {
  return editor.getWrapper()?.find(`#${CSS.escape(id)}`)[0]
}

function componentLabel(editor: Editor, id: string): string {
  const c = findById(editor, id)
  const name = c?.get("attributes")?.["data-gjs-name"] ?? c?.getName()
  return name ? `${name} (#${id})` : `#${id}`
}

/**
 * Builds the copilot's client tool instances. `getEditor` is read at
 * execution time (the editor instance is stable once ready); `sessionId`
 * groups this panel's code generations in Langfuse and pins them to one
 * OpenRouter provider instance so the static-guardrail prefix stays
 * cache-warm.
 */
export function createCopilotTools(
  getEditor: () => Editor | undefined,
  sessionId: string,
  tenantId: string | null
) {
  // Billed tenant, spread into every /api/generate body (undefined = unmetered).
  const billing = { tenantId: tenantId ?? undefined }

  const run = async (
    fn: (editor: Editor) => Promise<ToolResult> | ToolResult
  ): Promise<ToolResult> => {
    try {
      const editor = getEditor()
      if (!editor) return { success: false, summary: "Editor is not ready" }
      return await fn(editor)
    } catch (e) {
      return {
        success: false,
        summary: e instanceof Error ? e.message : String(e),
      }
    }
  }

  const addComponent = addComponentTool.client((args) =>
    run(async (editor) => {
      const { html } = await callGenerate({
        action: "add",
        plan: args.plan,
        componentName: args.name,
        targetIds: [args.componentId],
        position: args.position as CodegenPosition,
        threadId: sessionId,
        ...billing,
        ...editorSnapshot(editor),
      })
      const result = applyGenerated(editor, {
        action: "add",
        html,
        targetId: args.componentId,
        position: args.position as CodegenPosition,
      })
      return { success: result.ok, summary: result.summary }
    })
  )

  const editComponent = editComponentTool.client((args) =>
    run(async (editor) => {
      const ids = args.componentIds?.length
        ? args.componentIds
        : editor.getSelectedAll().map((c) => String(c.getId()))
      if (ids.length === 0) {
        return {
          success: false,
          summary:
            "No edit target: nothing is selected. Ask the user to select an element in the canvas, or pass componentIds.",
        }
      }
      const { html } = await callGenerate({
        action: "edit",
        plan: args.plan,
        targetIds: ids,
        threadId: sessionId,
        ...billing,
        ...editorSnapshot(editor),
      })
      const result = applyGenerated(editor, { action: "edit", html })
      return { success: result.ok, summary: result.summary }
    })
  )

  const generatePage = generatePageTool.client((args) =>
    run(async (editor) => {
      if ((editor.getWrapper()?.components().length ?? 0) > 0) {
        return {
          success: false,
          summary:
            "The page is not empty — use addComponent or editComponent instead.",
        }
      }
      // Stream a live preview into the canvas while the model types, then
      // commit the authoritative HTML once (single undo, real components).
      // clearPreview must run before applyGenerated and on any error path.
      try {
        const { html } = await streamGenerate(
          {
            action: "create",
            plan: args.plan,
            threadId: sessionId,
            ...billing,
            ...editorSnapshot(editor),
          },
          { onPreview: (h) => renderPreview(editor, h) }
        )
        clearPreview(editor)
        const result = applyGenerated(editor, { action: "create", html })
        return { success: result.ok, summary: result.summary }
      } finally {
        clearPreview(editor)
      }
    })
  )

  const removeComponent = removeComponentTool.client((args) =>
    run((editor) => {
      const target = findById(editor, args.componentId)
      if (!target) {
        return {
          success: false,
          summary: `No element with id "${args.componentId}" found`,
        }
      }
      const label = componentLabel(editor, args.componentId)
      target.remove()
      return { success: true, summary: `Removed ${label}` }
    })
  )

  const moveComponent = moveComponentTool.client((args) =>
    run((editor) => {
      const source = findById(editor, args.sourceId)
      const target = findById(editor, args.targetId)
      if (!source || !target) {
        return {
          success: false,
          summary: `Element not found: ${!source ? args.sourceId : args.targetId}`,
        }
      }
      // Appending an existing component instance moves it (collection add).
      target.append(source, { at: args.targetIndex })
      editor.select(source)
      return {
        success: true,
        summary: `Moved ${componentLabel(editor, args.sourceId)} into ${componentLabel(editor, args.targetId)} at index ${args.targetIndex}`,
      }
    })
  )

  return [
    addComponent,
    editComponent,
    generatePage,
    removeComponent,
    moveComponent,
  ]
}
