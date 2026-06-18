// Shared helpers for the built-in template parts (header/footer).

import type {
  ComponentDefinition,
  ProjectDefinition,
  Rule,
} from "@/lib/plugins/react-renderer/project/types"

// An editable text leaf. Must be a `text`-type component (not a bare
// `textnode`): GrapesJS only renders a DOM node for a `textnode` when it
// lives inside a `text` component, so a `textnode` dropped straight under a
// plain element has no element. The new drag sorter then counts it as a
// child but skips it when measuring children dimensions, and dropping into
// that element throws `childrenDimensions[index] is undefined`. This mirrors
// GrapesJS's own HTML parser, which promotes any all-text element to
// `type: "text"` for exactly this reason.
export const text = (
  content: string,
  extra?: Omit<ComponentDefinition, "type" | "content">
): ComponentDefinition => ({
  type: "text",
  content,
  ...extra,
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
