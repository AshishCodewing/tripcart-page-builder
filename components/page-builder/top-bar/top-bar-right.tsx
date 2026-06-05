"use client"

import { useCallback } from "react"
import { useFormStatus } from "react-dom"
import { useRouter } from "next/navigation"
import { DevicesProvider } from "@grapesjs/react"
import {
  Monitor,
  MoreVertical,
  Smartphone,
  Tablet,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  contentIndexHref,
  contentIndexLabel,
  contentStatus,
  contentTenantId,
  hasPreview,
  previewPath,
  type ContentStatus,
  type EditorContent,
} from "@/components/page-builder/types"
import { useIsDirty } from "@/lib/page-builder/save-status-store"
import { useFormGuard } from "@/hooks/use-form-guard"
import { useConfirmDialog } from "@/hooks/use-confirm-dialog"

type Props = {
  content: EditorContent
  className?: string
}

function getDeviceIcon(id: string): LucideIcon {
  const v = id.toLowerCase()
  if (v.includes("mobile") || v.includes("phone")) return Smartphone
  if (v.includes("tablet")) return Tablet
  return Monitor
}

// The two commit buttons read pending state from the enclosing <form> via
// useFormStatus. `data.get("status")` tells us *which* button is in flight
// (each submit button contributes its own name=status value), so we can
// label only the active one. The DRAFT button doubles as "Switch to draft"
// once published; the PUBLISHED button reads "Publish" → "Update".

function SaveDraftButton({ status }: { status: ContentStatus }) {
  const { pending, data } = useFormStatus()
  const inFlight = pending && data?.get("status") === "DRAFT"
  const isPublished = status === "PUBLISHED"
  return (
    <Button
      type="submit"
      name="status"
      value="DRAFT"
      variant="ghost"
      size="sm"
      className="text-primary"
      disabled={pending}
    >
      {inFlight
        ? isPublished
          ? "Switching..."
          : "Saving..."
        : isPublished
          ? "Switch to draft"
          : "Save draft"}
    </Button>
  )
}

function PublishButton({
  status,
  dirty,
}: {
  status: ContentStatus
  dirty: boolean
}) {
  const { pending, data } = useFormStatus()
  const inFlight = pending && data?.get("status") === "PUBLISHED"
  const isPublished = status === "PUBLISHED"
  // Once published with no new edits there's nothing to push, so the
  // primary action is inert — matching WP's greyed-out "Update".
  const nothingToPush = isPublished && !dirty
  return (
    <Button
      type="submit"
      name="status"
      value="PUBLISHED"
      size="sm"
      disabled={pending || nothingToPush}
    >
      {inFlight
        ? isPublished
          ? "Updating..."
          : "Publishing..."
        : isPublished
          ? "Update"
          : "Publish"}
    </Button>
  )
}

// Templates have no publish lifecycle — a template/pattern reaches the
// public site only by being inserted into a Page/Post, whose own status
// gates publication. So the template editor shows a single plain Save
// (no Publish / Switch-to-draft). It posts no `status` field, so
// `saveTemplate` leaves the row's status untouched.
function SaveButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving..." : "Save"}
    </Button>
  )
}

export default function TopBarRight({ content, className }: Props) {
  const isTemplate = content.kind === "template"
  // Tenant rides on the preview URL — `/api/preview` validates it and
  // redirects into `/preview/<tenantId><path>`, where the preview routes
  // read the tenant from the URL segment. Without it those routes can't
  // disambiguate when two tenants share a path. Templates have no
  // preview path (no public route) — `showPreview` gates the link.
  const tenantId = contentTenantId(content)
  const showPreview = hasPreview(content) && tenantId !== null
  const previewHref = showPreview
    ? `/api/preview?path=${encodeURIComponent(previewPath(content))}` +
      `&tenantId=${encodeURIComponent(tenantId)}`
    : ""
  const indexHref = contentIndexHref(content)
  const indexLabel = contentIndexLabel(content)
  const status = contentStatus(content)
  const dirty = useIsDirty()
  const router = useRouter()

  // Branded confirmation shared by every exit path we control, so they all
  // look the same. (Tab close / refresh is the one exception — that's the
  // browser's own un-styleable `beforeunload` dialog, owned by GrapesJS's
  // `noticeOnUnload`, which is why `guardUnload: false` here.)
  const { confirm, dialog } = useConfirmDialog({
    title: "Leave with unsaved changes?",
    description:
      "Your latest edits haven't been saved yet and will be lost if you leave this page.",
    confirmText: "Leave",
    cancelText: "Stay",
    destructive: true,
  })

  // Back / forward buttons (popstate) — handled inside the hook, which awaits
  // this modal via `onBlock`.
  useFormGuard({ isDirty: dirty, guardUnload: false, onBlock: confirm })

  // In-app soft navigation (Next 15.3+ <Link onNavigate>). onNavigate is
  // synchronous, so we cancel the click up front, ask via the same modal, then
  // resume the navigation imperatively when the user confirms.
  const guardIndexNav = useCallback(
    (event: { preventDefault: () => void }) => {
      if (!dirty) return
      event.preventDefault()
      void confirm().then((leave) => {
        if (leave) router.push(indexHref)
      })
    },
    [dirty, confirm, router, indexHref]
  )

  return (
    <div className={cn("flex items-center justify-end gap-2", className)}>
      {!isTemplate && <SaveDraftButton status={status} />}

      <DevicesProvider>
        {({ selected, select, devices }) => (
          <ToggleGroup
            variant="pill"
            size="sm"
            aria-label="Device"
            value={selected ? [selected] : []}
            onValueChange={(value) => {
              const id = value[0]
              if (id) select(id)
            }}
          >
            {devices
              .filter((device) => {
                const id = String(device.id).toLowerCase()
                const name = (device.getName() ?? "").toLowerCase()
                return !id.includes("landscape") && !name.includes("landscape")
              })
              .map((device) => {
                const id = String(device.id)
                const label = device.getName() ?? id
                const Icon = getDeviceIcon(id)
                return (
                  <ToggleGroupItem
                    key={id}
                    value={id}
                    aria-label={label}
                    className="group-data-[variant=pill]/toggle-group:px-2"
                  >
                    <Icon className="size-4" />
                  </ToggleGroupItem>
                )
              })}
          </ToggleGroup>
        )}
      </DevicesProvider>

      <SidebarTrigger type="button" aria-label="Toggle settings sidebar" />

      {isTemplate ? (
        <SaveButton />
      ) : (
        <PublishButton status={status} dirty={dirty} />
      )}

      <ThemeToggle />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="More"
            >
              <MoreVertical className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          {showPreview ? (
            <DropdownMenuItem
              render={
                <a href={previewHref} target="_blank" rel="noreferrer">
                  Preview
                </a>
              }
            />
          ) : null}
          <DropdownMenuItem
            render={<Link href={indexHref} onNavigate={guardIndexNav} />}
          >
            {indexLabel}
          </DropdownMenuItem>
          {showPreview ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled className="font-mono text-xs">
                {previewPath(content)}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {dialog}
    </div>
  )
}
