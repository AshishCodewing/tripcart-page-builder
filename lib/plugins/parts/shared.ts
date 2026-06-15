// Shared helpers for the built-in template parts (header/footer).

import type {
  ComponentDefinition,
  ProjectDefinition,
  Rule,
} from "@/lib/plugins/react-renderer/project/types"

export const text = (content: string): ComponentDefinition => ({
  type: "textnode",
  content,
})

// Wrap a chrome element in a throwaway root div: RenderProjectFragment strips
// the root (treating it as the body), so the inner <header>/<footer> is what
// actually renders.
export const wrapPart = (
  child: ComponentDefinition,
  styles: Rule[]
): ProjectDefinition => ({
  pages: [{ frames: [{ component: { tagName: "div", components: [child] } }] }],
  styles,
})
