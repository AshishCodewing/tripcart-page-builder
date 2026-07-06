// Isomorphic copilot tool definitions (plan 017). Client-safe: imported by
// components/ai/chat.tsx to create `.client(execute)` instances (the handlers
// close over the GrapesJS editor), and by app/api/chat/route.ts where the
// definitions' schemas are merged into chat() so the orchestrator sees them.
// The orchestrator only ever receives the small result objects — generated
// HTML never enters its context.
import { toolDefinition } from "@tanstack/ai"
import { z } from "zod"

const PLAN = z
  .string()
  .max(2000)
  .describe(
    "High-level plan for the layout, structure and content to generate — concrete enough for a developer to build from, max ~1500 characters."
  )

const codeResult = z.object({
  success: z.boolean(),
  summary: z.string(),
})

export const addComponentTool = toolDefinition({
  name: "addComponent",
  description:
    'Generate and add a new component/section to the page. Requires the id of an existing target element (from the page HTML in your context — for \'<section id="ii6z">\' the id is "ii6z") and a position relative to it.',
  inputSchema: z.object({
    name: z
      .string()
      .max(100)
      .describe("Short human-readable name of the new component"),
    plan: PLAN,
    componentId: z.string().describe("Id of the existing target element"),
    position: z
      .enum(["before", "beforeInside", "afterInside", "after"])
      .describe(
        "Placement relative to the target: before/after = as its sibling; beforeInside = as its first child; afterInside = as its last child."
      ),
  }),
  outputSchema: codeResult,
})

export const editComponentTool = toolDefinition({
  name: "editComponent",
  description:
    "Generate edits to existing elements on the page (rewording, restyling, restructuring). Defaults to the user's selected component; pass componentIds to target other elements. Requires user approval.",
  needsApproval: true,
  inputSchema: z.object({
    plan: PLAN,
    componentIds: z
      .array(z.string())
      .max(20)
      .optional()
      .describe(
        "Ids of the elements to edit. Omit to use the user's currently selected component."
      ),
  }),
  outputSchema: codeResult,
})

export const generatePageTool = toolDefinition({
  name: "generatePage",
  description:
    "Generate the full content for the page. ONLY valid when the page is empty (Is New Project = true in your context) — it refuses to run on a non-empty page.",
  inputSchema: z.object({ plan: PLAN }),
  outputSchema: codeResult,
})

export const removeComponentTool = toolDefinition({
  name: "removeComponent",
  description:
    "Remove an element from the page by its id. Faster than editComponent for deletions. Requires user approval.",
  needsApproval: true,
  inputSchema: z.object({
    componentId: z.string().describe("Id of the element to remove"),
  }),
  outputSchema: codeResult,
})

export const moveComponentTool = toolDefinition({
  name: "moveComponent",
  description:
    "Move an existing element to another position in the page. Faster than editComponent for reordering.",
  inputSchema: z.object({
    sourceId: z.string().describe("Id of the element to move"),
    targetId: z
      .string()
      .describe("Id of the parent element to place the source into"),
    targetIndex: z
      .number()
      .int()
      .min(0)
      .describe("Child index inside the target at which to place the source"),
  }),
  outputSchema: codeResult,
})

export const copilotToolDefinitions = [
  addComponentTool,
  editComponentTool,
  generatePageTool,
  removeComponentTool,
  moveComponentTool,
]
