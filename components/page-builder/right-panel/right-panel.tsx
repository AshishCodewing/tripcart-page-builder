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
  SidebarSeparator,
} from "@/components/ui/sidebar"
import {
  Tabs,
  TabsContent,
  TabsIndicator,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  contentKindLabel,
  type EditorContent,
  type PageContent,
  type PostContent,
} from "@/components/page-builder/types"

type Props = {
  content: EditorContent
  /** Server action bound to the record id. */
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

export default function RightPanel({ content, deleteAction }: Props) {
  const record = content.kind === "page" ? content.page : content.post
  const isPublished = record.status === "PUBLISHED"
  const kindLabel = contentKindLabel(content)
  const tabValue = content.kind

  return (
    <Tabs defaultValue={tabValue} className="h-full">
      <TabsList variant="line" className="w-full justify-start">
        <TabsTrigger value={tabValue}>{kindLabel}</TabsTrigger>
        <TabsTrigger value="block">Block</TabsTrigger>
        <TabsIndicator />
      </TabsList>

      <TabsContent value={tabValue} className="flex min-h-0 flex-col">
        <SidebarContent className="px-3 py-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">{record.title}</p>
            <p className="text-xs text-muted-foreground">
              Last edited {formatRelative(record.updatedAt)}
            </p>
          </div>

          <SidebarSeparator className="my-4" />

          <SidebarGroup className="p-0">
            <SidebarGroupContent className="flex flex-col gap-3">
              <FieldRow label="Status">
                <Badge
                  variant={isPublished ? "default" : "secondary"}
                  className="capitalize"
                >
                  {record.status.toLowerCase()}
                </Badge>
              </FieldRow>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="title" className="text-xs">
                  Title
                </Label>
                <Input
                  id="title"
                  name="title"
                  defaultValue={record.title}
                  inputSize="sm"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="slug" className="text-xs">
                  Slug
                </Label>
                <Input
                  id="slug"
                  name="slug"
                  defaultValue={record.slug}
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

              {content.kind === "page" ? (
                <PageOnlyFields content={content} isPublished={isPublished} />
              ) : (
                <PostOnlyFields content={content} />
              )}
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
            <Trash2 data-icon="inline-start" />
            Move to trash
          </Button>
        </SidebarFooter>
      </TabsContent>

      <TabsContent value="block" className="flex min-h-0 flex-col">
        <div className="px-3 py-4 text-sm text-muted-foreground">
          Select a component to edit its block settings.
        </div>
      </TabsContent>
    </Tabs>
  )
}

function PageOnlyFields({
  content,
  isPublished,
}: {
  content: PageContent
  isPublished: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="parentId" className="text-xs">
        Parent
      </Label>
      <Select
        name="parentId"
        defaultValue={content.page.parentId ?? ""}
        disabled={isPublished}
      >
        <SelectTrigger id="parentId" size="sm" className="w-full">
          <SelectValue placeholder="— Top level —" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">— Top level —</SelectItem>
          {content.parentOptions.map((opt) => (
            <SelectItem key={opt.id} value={opt.id}>
              {opt.title} (/{opt.path})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function PostOnlyFields({ content }: { content: PostContent }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="excerpt" className="text-xs">
        Excerpt
      </Label>
      <Textarea
        id="excerpt"
        name="excerpt"
        defaultValue={content.post.excerpt ?? ""}
        rows={3}
      />
    </div>
  )
}
