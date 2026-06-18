"use client"

import * as React from "react"

import {
  TEMPLATE_HIERARCHY,
  getHierarchyEntry,
  isHierarchySlug,
} from "@/lib/cms/template-hierarchy"
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox"
import { Label } from "@/components/ui/label"

const HIERARCHY_SLUGS = TEMPLATE_HIERARCHY.map((e) => e.slug)

// Slug → human title, used both for the dropdown's type-to-filter label and
// for rendering the selected chips. Keeping the combobox value as the slug (not
// the title) means it submits straight to `saveTemplate` with no remapping.
function labelOf(slug: string) {
  return getHierarchyEntry(slug)?.title ?? slug
}

// "Used on" assignment for a header/footer PART: pick which template-hierarchy
// templates (`page`, `single`, `archive`, …) render this part as their chrome.
// This is the inverse of the per-segment chrome resolver — editing the part is
// where you say where it appears (see resolveSegmentChrome / ChromeAssignment).
//
// State is local; the selection is submitted with the enclosing editor <form>
// (the template Save button) via hidden inputs, which `saveTemplate` reads with
// `form.getAll("chromeHierarchy")`. The always-present marker input lets the
// server tell "the Part editor submitted this (reconcile rows)" from "a
// non-editor caller omitted it (leave assignments untouched)".
export function ChromeAssignmentSelect({
  area,
  initial,
  taken = {},
}: {
  area: "header" | "footer"
  initial: string[]
  // Segment slug → title of the *other* part that currently owns it. Selecting
  // such a segment reassigns it here (the save overwrites the slot), so the
  // dropdown flags it rather than blocking it.
  taken?: Record<string, string>
}) {
  const [selected, setSelected] = React.useState<string[]>(initial)
  const anchor = useComboboxAnchor()

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs">Used on</Label>
      <p className="text-[11px] leading-tight text-muted-foreground">
        Templates that render this {area} as their site {area}.
      </p>

      <Combobox
        multiple
        autoHighlight
        items={HIERARCHY_SLUGS}
        value={selected}
        onValueChange={setSelected}
        itemToStringLabel={labelOf}
      >
        <ComboboxChips ref={anchor} className="w-full">
          <ComboboxValue>
            {(values: string[]) => (
              <React.Fragment>
                {values.map((slug) => (
                  <ComboboxChip key={slug}>{labelOf(slug)}</ComboboxChip>
                ))}
                <ComboboxChipsInput
                  placeholder={values.length ? "" : "Add a template…"}
                />
              </React.Fragment>
            )}
          </ComboboxValue>
        </ComboboxChips>
        <ComboboxContent anchor={anchor}>
          <ComboboxEmpty>No templates found.</ComboboxEmpty>
          <ComboboxList>
            {(slug: string) => (
              <ComboboxItem key={slug} value={slug}>
                <span className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium">{labelOf(slug)}</span>
                  <span className="line-clamp-2 text-[11px] leading-tight text-muted-foreground">
                    {getHierarchyEntry(slug)?.description}
                  </span>
                  {taken[slug] && (
                    <span className="text-[11px] leading-tight font-medium text-amber-600 dark:text-amber-500">
                      Currently uses “{taken[slug]}” — select to reassign
                    </span>
                  )}
                </span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      {/* Submitted with the template Save (see component doc). */}
      <input type="hidden" name="chromeHierarchyPresent" value="1" />
      {selected.filter(isHierarchySlug).map((slug) => (
        <input key={slug} type="hidden" name="chromeHierarchy" value={slug} />
      ))}
    </div>
  )
}
