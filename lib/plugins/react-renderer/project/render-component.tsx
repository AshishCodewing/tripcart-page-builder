// Recursive renderer for a saved-project component subtree. No editor,
// no view binding, no GrapesJS runtime — pure React from a JSON snapshot,
// safe to run during SSR.

import { createElement, type ElementType } from "react"
import { attrsToReactProps } from "../attrs"
import { booleanAttrPresent, selectDefaultValue } from "../form-controls"
import { getComponentId } from "./util"
import type { ComponentNode } from "./parser"
import type { RenderComponentProps } from "./types"

const isTab = (c: ComponentNode) =>
  c.type === "tc-tab" || c.attributes.role === "tab"
const isTabPanel = (c: ComponentNode) =>
  c.type === "tc-tab-panel" || c.attributes.role === "tabpanel"

// The initially-open tab for a `tc-tabs` subtree — the first tab carrying
// `aria-selected="true"` (set by the "Open by default" trait), else the first
// tab. Mirrors the runtime enhancer (lib/web-components/tabs.ts #wire) so the
// server markup already matches what the web component would produce.
const resolveActiveTabIndex = (tabs: ComponentNode): number => {
  const list = tabs.components.find(
    (c) => c.type === "tc-tab-list" || c.attributes.role === "tablist"
  )
  const tabEls = (list?.components ?? []).filter(isTab)
  const preset = tabEls.findIndex(
    (t) => t.attributes["aria-selected"] === "true"
  )
  return preset >= 0 ? preset : 0
}

export const RenderComponent = (props: RenderComponentProps) => {
  const { component, config, children, parentId, index, tabsCtx } = props
  if (!component) return null

  const { type, content } = component

  // Text nodes serialize as plain strings; React renders them inline.
  if (type === "textnode") return content

  const cfgEntry = config?.components?.[type]
  const Tag = ((cfgEntry?.component as ElementType | undefined) ||
    component.tagName ||
    "div") as ElementType

  const { key, nodeId } = getComponentId(component, parentId, index)
  const isReactCmp = !!cfgEntry?.component

  const reactProps = attrsToReactProps(component.attributes) as Record<
    string,
    unknown
  >

  // For registered React components, coerce numeric-looking strings into
  // numbers so the component receives `width={123}` instead of `width="123"`.
  // Coercion is round-trip-safe: only values where `String(Number(v)) === v`
  // convert, so "01234", " 123 ", "1e5", and "" stay strings (no silent data
  // loss). The canvas renderer always passes raw strings, so registered
  // components must tolerate both a string and a number for the same prop.
  if (isReactCmp) {
    Object.keys(reactProps).forEach((k) => {
      const v = reactProps[k]
      if (typeof v === "string" && v !== "" && String(Number(v)) === v) {
        reactProps[k] = Number(v)
      }
    })
  }

  // Entering a `tc-tabs` establishes a new context for its subtree; other nodes
  // just forward whatever context they're already in (nearest tc-tabs wins, so
  // nested tabs resolve independently).
  const childTabsCtx =
    component.type === "tc-tabs"
      ? { activeIndex: resolveActiveTabIndex(component) }
      : tabsCtx

  const childCmps = component.components
  const childNodes = childCmps.length
    ? childCmps.map((child, i) => (
        <RenderComponent
          key={`${child.id ?? "n"}-${i}`}
          config={config}
          component={child}
          parentId={key}
          index={i}
          tabsCtx={childTabsCtx}
        />
      ))
    : [content]

  const merged = [...childNodes, children]
  const finalProps: Record<string, unknown> = {
    ...reactProps,
    ...(nodeId ? { id: nodeId } : {}),
  }

  // Flash-free initial state: emit the active tab + hidden panels server-side
  // (the runtime enhancer loads only after hydration, so without this every
  // panel is briefly visible). `index` is the node's position among its
  // siblings, which for tabs/panels is their ordinal within the tablist/panels
  // wrapper — the same ordinal the runtime activates by.
  if (tabsCtx && index != null) {
    if (isTab(component)) {
      const active = index === tabsCtx.activeIndex
      // `aria-selected` is the sole active-state hook: the default CSS styles
      // `[role="tab"][aria-selected="true"]` (see lib/plugins/interactive/
      // tabs.ts) and the runtime enhancer reads it, so no active class is
      // emitted — one attribute drives both the flash-free SSR state and the
      // post-hydration state.
      finalProps["aria-selected"] = active ? "true" : "false"
    } else if (isTabPanel(component) && index !== tabsCtx.activeIndex) {
      finalProps.hidden = true
    }
  }

  // React treats raw form controls as (un)controlled inputs (children on
  // <textarea> throw, `selected` on <option> warns), while GrapesJS stores
  // the parsed-HTML shape — translate to defaultValue (see ../form-controls).
  if (!isReactCmp) {
    const tag = component.tagName.toLowerCase()
    if (tag === "textarea") {
      const text =
        childCmps
          .filter((c) => c.type === "textnode")
          .map((c) => c.content)
          .join("") || content
      return createElement(Tag, {
        ...finalProps,
        key,
        defaultValue: text || undefined,
      })
    }
    if (tag === "option") delete finalProps.selected
    if (tag === "input" && "checked" in finalProps) {
      finalProps.defaultChecked = booleanAttrPresent(finalProps.checked)
      delete finalProps.checked
    }
    if (
      tag === "select" &&
      !("value" in finalProps) &&
      !("defaultValue" in finalProps)
    ) {
      const defaultValue = selectDefaultValue(
        childCmps
          .filter((c) => c.tagName.toLowerCase() === "option")
          .map((c) => ({
            selected: booleanAttrPresent(c.attributes.selected),
            value:
              typeof c.attributes.value === "string"
                ? c.attributes.value
                : undefined,
            text: c.components
              .filter((t) => t.type === "textnode")
              .map((t) => t.content)
              .join(""),
          })),
        booleanAttrPresent(finalProps.multiple)
      )
      if (defaultValue !== undefined) finalProps.defaultValue = defaultValue
    }
  }

  // React-component path uses the JSX runtime so children are passed via
  // props.children (which the consumer expects). Raw-tag path uses
  // createElement with `key` as the third hand-off so void elements can pass
  // `null` children explicitly.
  if (isReactCmp) {
    return (
      <Tag {...finalProps} key={key}>
        {merged}
      </Tag>
    )
  }
  return createElement(
    Tag,
    { ...finalProps, key },
    component.isVoid ? null : merged
  )
}
