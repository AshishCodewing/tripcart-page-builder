"use client"

import { PanelBottomIcon, PanelTopIcon, PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { createTemplate } from "@/lib/cms/template-actions"

// Area options for a Template Part. Restricted to the two site-chrome slots
// for now; widen here when sidebar / other areas are needed.
const PART_AREAS = [
  {
    value: "header",
    title: "Header",
    description:
      "The Header template defines a page area that typically contains a title, logo, and main navigation.",
    icon: PanelTopIcon,
  },
  {
    value: "footer",
    title: "Footer",
    description:
      "The Footer template defines a page area that typically contains site credits, social links, or any other combination of blocks.",
    icon: PanelBottomIcon,
  },
] as const

type Props = {
  tenantId: string
  kind: "LAYOUT" | "PATTERN" | "PART"
  label: string
}

/**
 * Create flow for the Library pages: enter a title (plus an Area for PARTs),
 * submit, and the server action creates a blank template of `kind` and
 * redirects into the editor. The dialog stays open until the redirect
 * navigates away (a server-action redirect short-circuits the submit).
 *
 * A PART needs an `area` — a radio choice (header / footer for now), required
 * by `createTemplate` and used to classify the part in the Library. Authoring
 * a PART titled "Header"/"Footer" claims the reserved chrome slug and becomes
 * the site header/footer (see `resolveChromeBySlug`).
 */
export function AddTemplateDialog({ tenantId, kind, label }: Props) {
  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" />}>
        <PlusIcon />
        {label}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>
        <form
          action={createTemplate.bind(null, tenantId)}
          className="space-y-4"
        >
          <input type="hidden" name="kind" value={kind} />
          <div className="space-y-2">
            <Label htmlFor="template-title">Title</Label>
            <Input id="template-title" name="title" autoFocus required />
          </div>
          {kind === "PART" && (
            <div className="space-y-2">
              <Label>Area</Label>
              <RadioGroup
                name="area"
                defaultValue={PART_AREAS[0].value}
                required
              >
                {PART_AREAS.map((area) => (
                  <FieldLabel key={area.value} htmlFor={`area-${area.value}`}>
                    <Field orientation="horizontal">
                      <FieldContent>
                        <FieldTitle>
                          <area.icon className="size-4" />
                          {area.title}
                        </FieldTitle>
                        <FieldDescription>{area.description}</FieldDescription>
                      </FieldContent>
                      <RadioGroupItem
                        value={area.value}
                        id={`area-${area.value}`}
                      />
                    </Field>
                  </FieldLabel>
                ))}
              </RadioGroup>
            </div>
          )}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit">Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
