/**
 * Single-post template binding (Plan 013, "Option C").
 *
 * A user authors a single-post template as a `kind: LAYOUT` at the reserved
 * template-hierarchy slug `single`, arranging four locked field blocks on the
 * canvas: Post Title, Post Featured Image, Post Date, and a Content slot (the
 * post body). At render we bind each field block to the current post and pour
 * the resolved post body into the content slot.
 *
 * The renderer (`react-renderer/project/render-component.tsx`) has no
 * data-context mechanism — it maps `node.type → config.components[type]` and
 * otherwise renders the raw `tagName`. So binding is a **pure server-side tree
 * transform** run before the renderer: it handles all four field types
 * uniformly, addresses arbitrarily-nested nodes, and needs zero renderer
 * changes. This mirrors `resolvePageTree`'s philosophy.
 *
 * Render-correctness rules (load-bearing — see Plan 013):
 *   - title / date bind by setting `content` + `components: []` and render via
 *     their author-chosen raw `tagName` (`h1`, `time`, …). They are NOT
 *     registered as React components, so heading semantics survive.
 *   - the content slot keeps its own element + id/class (so the author can
 *     style the content column) and has its `components` set to the post
 *     body's children. First slot in document order wins; later slots stay
 *     empty; if there is no slot, the body is appended at the layout root so
 *     content is never lost.
 *   - featured image binds `attributes.src`; a null image filters the node out
 *     of its parent (no broken `<img>`).
 */

import { loadTemplate, resolvePageTree, type TemplateBody } from "./templates"
import { unwrapTemplateRoot } from "./template-shape"
import type {
  ComponentDefinition,
  ProjectDefinition,
} from "@/lib/plugins/react-renderer/project/types"

/** The reserved template-hierarchy slug a single-post LAYOUT lives at. */
export const SINGLE_POST_SLUG = "single"

/**
 * Component `type`s the field blocks carry. Kept in sync with the editor
 * plugin (`lib/plugins/post-fields.ts`, Phase 2) so the authored nodes match
 * what `bindPostTemplate` looks for.
 */
export const POST_FIELD_TYPES = {
  title: "post-title",
  featuredImage: "post-featured-image",
  date: "post-date",
  contentSlot: "content-slot",
} as const

/** The subset of a Post the binder reads. */
export type BindablePost = {
  title: string
  publishedAt: Date | null
  featuredImage: string | null
}

/** Long-form date for the Post Date field block. Stable `en-US` format. */
export function formatPostDate(publishedAt: Date): string {
  return publishedAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

/**
 * Bind a resolved single-post LAYOUT tree to a concrete post: fill the field
 * blocks, pour `bodyChildren` into the first content slot. Pure — returns a
 * new tree via structural sharing; the input is never mutated.
 *
 * `bodyChildren` are the children of the resolved post-body root (the post's
 * own `ProjectDefinition`, already run through `resolvePageTree`).
 */
export function bindPostTemplate(
  layoutRoot: ComponentDefinition,
  post: BindablePost,
  bodyChildren: ComponentDefinition[]
): ComponentDefinition {
  const state = { slotFilled: false }

  // Returns null to signal "drop me from the parent's children" (a null
  // featured image). The root is never dropped — see the coalesce below.
  function walk(node: ComponentDefinition): ComponentDefinition | null {
    switch (node.type) {
      case POST_FIELD_TYPES.title:
        return { ...node, content: post.title, components: [] }

      case POST_FIELD_TYPES.date:
        return {
          ...node,
          content: post.publishedAt ? formatPostDate(post.publishedAt) : "",
          components: [],
        }

      case POST_FIELD_TYPES.featuredImage:
        if (!post.featuredImage) return null
        return {
          ...node,
          attributes: { ...node.attributes, src: post.featuredImage },
          components: [],
        }

      case POST_FIELD_TYPES.contentSlot:
        if (state.slotFilled) return { ...node, components: [] }
        state.slotFilled = true
        return { ...node, components: bodyChildren }
    }

    const children = node.components
    if (!Array.isArray(children) || children.length === 0) return node
    const resolved: ComponentDefinition[] = []
    for (const child of children) {
      const bound = walk(child)
      if (bound !== null) resolved.push(bound)
    }
    return { ...node, components: resolved }
  }

  const boundRoot = walk(layoutRoot) ?? { ...layoutRoot, components: [] }

  // No content slot in the layout → append the body at the root so the post
  // is never dropped silently. A misconfiguration, so warn in dev.
  if (!state.slotFilled) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[post-template] single LAYOUT has no "${POST_FIELD_TYPES.contentSlot}"; ` +
          "appending the post body at the layout root."
      )
    }
    return {
      ...boundRoot,
      components: [...(boundRoot.components ?? []), ...bodyChildren],
    }
  }

  return boundRoot
}

export type SinglePostRender =
  | { kind: "layout"; projectData: ProjectDefinition }
  | { kind: "default" }

/**
 * Resolve how a single post should render. If the tenant (tenant-first /
 * global-fallback via `loadTemplate`) has a `single` LAYOUT, bind it to the
 * post and return the composed project; otherwise return `{ kind: "default" }`
 * so the route falls back to its hardcoded article (non-breaking).
 *
 * Both the LAYOUT and the post body are run through `resolvePageTree` first, so
 * any nested `template-ref`s expand and their styles merge before binding —
 * the binder only ever sees concrete nodes plus the four field types.
 */
export async function resolveSinglePostRender(
  tenantId: string,
  post: BindablePost & { data: unknown }
): Promise<SinglePostRender> {
  const tpl = await loadTemplate(tenantId, SINGLE_POST_SLUG)
  // Only a LAYOUT at the reserved slug is a single-post template. The
  // create/rename guard (`assertReservedSlug`) enforces this, but resolving by
  // slug means a legacy/foreign row could still sit here — ignore it.
  if (!tpl || tpl.kind !== "LAYOUT") return { kind: "default" }

  const body = tpl.data as TemplateBody | null
  const rawRoot = body?.component ?? body?.pages?.[0]?.frames?.[0]?.component
  if (!rawRoot) return { kind: "default" }

  // Resolve the LAYOUT's own tree (expand its template-refs, collect styles).
  const resolvedLayout = await resolvePageTree(tenantId, {
    pages: [{ frames: [{ component: unwrapTemplateRoot(rawRoot) }] }],
    styles: body?.styles ?? [],
  })
  const layoutPage = resolvedLayout.pages?.[0]
  const layoutFrame = layoutPage?.frames?.[0]
  const layoutRoot = layoutFrame?.component
  if (!layoutPage || !layoutFrame || !layoutRoot) return { kind: "default" }

  // Resolve the post body the same way; its root's children pour into the slot.
  const resolvedBody = await resolvePageTree(
    tenantId,
    (post.data ?? {}) as ProjectDefinition
  )
  const bodyRoot = resolvedBody.pages?.[0]?.frames?.[0]?.component
  const bodyChildren = bodyRoot?.components ?? []

  const bound = bindPostTemplate(layoutRoot, post, bodyChildren)

  const projectData: ProjectDefinition = {
    ...resolvedLayout,
    pages: [
      {
        ...layoutPage,
        frames: [
          { ...layoutFrame, component: bound },
          ...layoutPage.frames!.slice(1),
        ],
      },
      ...resolvedLayout.pages!.slice(1),
    ],
    // Layout styles first, post-body styles last so the body wins ties
    // (document order — the post's own rules are the more specific intent).
    styles: [...(resolvedLayout.styles ?? []), ...(resolvedBody.styles ?? [])],
  }

  return { kind: "layout", projectData }
}
