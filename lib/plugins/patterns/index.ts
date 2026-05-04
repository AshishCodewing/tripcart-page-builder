/**
 * Registers Tripcart pattern blocks (hero, faq, footer, …) with the editor.
 *
 * Pattern blocks are tagged with `attributes: { 'data-pattern': 'true' }` at
 * registration time so the React block-inserter can route them into the
 * "Patterns" tab while leaving atomic blocks (text, image, columns, …) in
 * the "Blocks" tab.
 */

import type { Block, Editor } from "grapesjs"
import { registerHeroBlock } from "./hero-block/hero-block"
import { registerAboutBlock } from "./about-block/about-block"
import { registerCtaBlock } from "./cta-block/cta-block"

export const patternsPlugin = (editor: Editor): void => {
  registerHeroBlock(editor)
  registerAboutBlock(editor)
  registerCtaBlock(editor)
}

/**
 * True for blocks tagged as patterns at registration time. Used by the
 * block-inserter to split blocks vs patterns into separate tabs.
 */
export const isPatternBlock = (block: Block): boolean => {
  const attrs = block.get("attributes") as Record<string, string> | undefined
  return attrs?.["data-pattern"] === "true"
}
