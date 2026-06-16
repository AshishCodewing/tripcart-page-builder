"use client"

import * as React from "react"
import { useEditorMaybe } from "@grapesjs/react"
import { Trash2 } from "lucide-react"

import { useConfirmDialog } from "@/hooks/use-confirm-dialog"
import { useIsClient } from "@/hooks/use-is-client"
import { formatTemplateRefUsage } from "@/lib/cms/template-ref-usage"
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
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  contentKindLabel,
  contentStatus,
  type EditorContent,
  type PageContent,
  type PostContent,
  type TemplateContent,
} from "@/components/page-builder/types"
import BlockSettings from "../managers/block-settings"
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

function RelativeTime({ date }: { date: Date }) {
  // `formatRelative` reads `Date.now()`, which differs between server and
  // client, so render an empty string until hydrated to avoid a mismatch.
  const isClient = useIsClient()
  // Re-render every 30s to keep the relative label fresh. The tick is a
  // timer callback (not a synchronous effect-body setState), and the label
  // itself is derived during render rather than mirrored into state.
  const [, tick] = React.useReducer((n: number) => n + 1, 0)
  React.useEffect(() => {
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [])
  return <>{isClient ? formatRelative(date) : ""}</>
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

function recordOf(content: EditorContent) {
  switch (content.kind) {
    case "page":
      return content.page
    case "post":
      return content.post
    case "template":
      return content.template
  }
}

export default function RightPanel({ content, deleteAction }: Props) {
  const editor = useEditorMaybe()
  const record = recordOf(content)
  // Templates have no publish lifecycle; status is page/post-only.
  const status = content.kind === "template" ? null : contentStatus(content)
  const isPublished = status === "PUBLISHED"
  const kindLabel = contentKindLabel(content)
  const tabValue = content.kind

  const [activeTab, setActiveTab] = React.useState<string>(tabValue)

  // Confirm before "Move to trash". For a template that's still referenced,
  // spell out the reference count (§5) so the user knows what will break —
  // deleting leaves `missing:<slug>` placeholders wherever it's used.
  const deleteDescription =
    content.kind === "template" && content.template.refUsage.total > 0
      ? `This template is referenced by ${formatTemplateRefUsage(
          content.template.refUsage
        )}. Deleting it leaves a missing-template placeholder wherever it's ` +
        `used. This can't be undone.`
      : `Deleting this ${kindLabel.toLowerCase()} can't be undone.`

  const { confirm, dialog } = useConfirmDialog({
    title: `Move this ${kindLabel.toLowerCase()} to trash?`,
    description: deleteDescription,
    confirmText: "Move to trash",
    destructive: true,
  })

  const handleDelete = React.useCallback(async () => {
    if (await confirm()) await deleteAction()
  }, [confirm, deleteAction])

  React.useEffect(() => {
    if (!editor) return
    const showBlock = () => setActiveTab("block")
    const showRecord = () => setActiveTab(tabValue)
    editor.on("component:selected", showBlock)
    editor.on("component:deselected", showRecord)
    return () => {
      editor.off("component:selected", showBlock)
      editor.off("component:deselected", showRecord)
    }
  }, [editor, tabValue])

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="h-full gap-0"
    >
      <TabsList variant="line" className="w-full justify-start">
        <TabsTrigger value={tabValue}>{kindLabel}</TabsTrigger>
        <TabsTrigger value="block">Block</TabsTrigger>
        <TabsIndicator />
      </TabsList>

      <TabsContent
        value={tabValue}
        className="@apply flex min-h-0 flex-col opacity-100 transition-opacity duration-150 ease-out motion-reduce:transition-none starting:opacity-0"
      >
        <SidebarContent className="px-3 py-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">{record.title}</p>
            <p className="text-xs text-muted-foreground">
              Last edited <RelativeTime date={record.updatedAt} />
            </p>
          </div>

          <SidebarSeparator className="my-4" />

          <SidebarGroup className="p-0">
            <SidebarGroupContent className="flex flex-col gap-3">
              {status !== null && (
                <FieldRow label="Status">
                  <Badge
                    variant={isPublished ? "default" : "secondary"}
                    className="capitalize"
                  >
                    {status.toLowerCase()}
                  </Badge>
                </FieldRow>
              )}

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
                  pattern="[a-z0-9\-]+"
                  required
                  inputSize="sm"
                  disabled={isPublished || content.kind === "template"}
                />
                {content.kind === "template" ? (
                  <p className="text-xs text-muted-foreground">
                    A template&apos;s slug is fixed — rename it with the Title
                    above.
                  </p>
                ) : (
                  isPublished && (
                    <p className="text-xs text-muted-foreground">
                      Move to draft to rename.
                    </p>
                  )
                )}
              </div>

              {content.kind === "page" ? (
                <PageOnlyFields content={content} isPublished={isPublished} />
              ) : content.kind === "post" ? (
                <PostOnlyFields content={content} />
              ) : (
                <TemplateOnlyFields content={content} />
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t">
          <Button
            type="button"
            onClick={() => void handleDelete()}
            variant="outline"
            size="sm"
            className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 data-icon="inline-start" />
            Move to trash
          </Button>
          {dialog}
        </SidebarFooter>
      </TabsContent>

      <TabsContent
        value="block"
        className="@apply flex min-h-0 flex-col opacity-100 transition-opacity duration-150 ease-out motion-reduce:transition-none starting:opacity-0"
      >
        <BlockSettings />
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

// Editable template metadata (§4). These inputs ride the same enclosing
// editor <form> as the shared title/slug fields, so the template Save
// button posts them all; `saveTemplate` reads + validates them. Kind is
// controlled so the Area field can show only for PART templates.
function TemplateOnlyFields({ content }: { content: TemplateContent }) {
  const { kind, synced } = content.template
  // Controlled, not `defaultChecked`: Base UI reads an uncontrolled Switch's
  // default only once, so if `synced` settles after the first render the
  // toggle desyncs from the row (and a save can silently flip it). See the
  // synced round-trip verification — controlled state keeps it stable.
  const [syncedOn, setSyncedOn] = React.useState(synced)

  // Kind, area, and slug are fixed after creation — like WP, the right panel
  // only lets you rename a template (the shared Title field). Changing kind or
  // area is a re-author, not an edit, and a slug rename would break every
  // reference; both are intentionally not surfaced here.
  //
  // Sync is the one remaining PATTERN/LAYOUT choice (ref vs. copy on insert).
  // PARTs are always by-reference (synced by intent — see `saveTemplate`),
  // like a WP template part, so no toggle: it would only ever flip a part to a
  // meaningless "unsynced" state.
  if (kind === "PART") return null

  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor="synced" className="text-xs">
        Synced
      </Label>
      <Switch
        id="synced"
        name="synced"
        checked={syncedOn}
        onCheckedChange={setSyncedOn}
        size="sm"
      />
    </div>
  )
}
