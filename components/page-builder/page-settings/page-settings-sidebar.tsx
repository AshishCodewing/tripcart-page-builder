"use client"

import * as React from "react"
import { Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TabsIndicator,
} from "@/components/ui/tabs"

type PageSummary = {
  id: string
  title: string
  slug: string
  parentId: string | null
  path: string
  status: "DRAFT" | "PUBLISHED"
  updatedAt: Date
}

type ParentOption = {
  id: string
  title: string
  path: string
}

type Props = {
  page: PageSummary
  parentOptions: ParentOption[]
  /** Server action bound to the page id. */
  deleteAction: () => Promise<void>
}

const RTF = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

function formatRelative(date: Date): string {
  const diffMs = date.getTime() - Date.now()
  const absSec = Math.abs(diffMs) / 1000
  if (absSec < 60) return RTF.format(Math.round(diffMs / 1000), "second")
  if (absSec < 3600) return RTF.format(Math.round(diffMs / 60_000), "minute")
  if (absSec < 86_400) return RTF.format(Math.round(diffMs / 3_600_000), "hour")
  return RTF.format(Math.round(diffMs / 86_400_000), "day")
}

export default function PageSettingsSidebar({
  page,
  parentOptions,
  deleteAction,
}: Props) {
  const isPublished = page.status === "PUBLISHED"

  return (
    <Tabs defaultValue="page">
      <TabsList variant="line" className="w-full justify-start">
        <TabsTrigger value="page">Page</TabsTrigger>
        <TabsTrigger value="block">Block</TabsTrigger>
        <TabsIndicator />
      </TabsList>

      <TabsContent value="page">
        <SidebarContent className="px-3 py-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">{page.title}</p>
            <p className="text-xs text-muted-foreground">
              Last edited {formatRelative(page.updatedAt)}
            </p>
          </div>

          <SidebarSeparator className="my-4" />

          <SidebarGroup className="p-0">
            <SidebarGroupContent className="space-y-3">
              <FieldRow label="Status">
                <Badge
                  variant={isPublished ? "default" : "secondary"}
                  className="capitalize"
                >
                  {page.status.toLowerCase()}
                </Badge>
              </FieldRow>

              <div className="space-y-1.5">
                <Label htmlFor="title" className="text-xs">
                  Title
                </Label>
                <Input
                  id="title"
                  name="title"
                  defaultValue={page.title}
                  inputSize="sm"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="slug" className="text-xs">
                  Slug
                </Label>
                <Input
                  id="slug"
                  name="slug"
                  defaultValue={page.slug}
                  pattern="[a-z0-9-]+"
                  required
                  inputSize="sm"
                  disabled={isPublished}
                />
                {isPublished && (
                  <p className="text-xs text-muted-foreground">
                    Move to draft to rename.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="parentId" className="text-xs">
                  Parent
                </Label>
                <Select
                  name="parentId"
                  defaultValue={page.parentId ?? ""}
                  disabled={isPublished}
                >
                  <SelectTrigger id="parentId" size="sm" className="w-full">
                    <SelectValue placeholder="— Top level —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— Top level —</SelectItem>
                    {parentOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.title} (/{opt.path})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t">
          <Button
            type="submit"
            formAction={deleteAction}
            formNoValidate
            variant="outline"
            size="sm"
            className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-4" />
            Move to trash
          </Button>
        </SidebarFooter>
      </TabsContent>

      <TabsContent value="block">
        <div className="px-3 py-4 text-sm text-muted-foreground">
          Select a component to edit its block settings.
        </div>
      </TabsContent>
    </Tabs>
  )
}

function FieldRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div>{children}</div>
    </div>
  )
}
