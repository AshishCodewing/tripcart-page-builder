"use client"

import { PlusIcon } from "lucide-react"

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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createTemplate } from "@/lib/cms/template-actions"

type Props = {
  tenantId: string
  kind: "LAYOUT" | "PATTERN"
  label: string
}

/**
 * Single-field create flow for the Library pages: enter a title, submit,
 * and the server action creates a blank template of `kind` and redirects
 * into the editor. The dialog stays open until the redirect navigates
 * away (a server-action redirect short-circuits the submit).
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
