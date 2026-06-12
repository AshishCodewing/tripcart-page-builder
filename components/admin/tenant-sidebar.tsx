"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ChevronRightIcon,
  FileIcon,
  LayoutTemplateIcon,
  NewspaperIcon,
  PaletteIcon,
  type LucideIcon,
} from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

type NavLink = { label: string; href: string; icon: LucideIcon }
type NavTree = {
  label: string
  icon: LucideIcon
  /** Prefix used to compute the active/expanded state. */
  base: string
  children: { label: string; href: string }[]
}
type NavItem = NavLink | NavTree
type NavGroup = { label: string; items: NavItem[] }

const isTree = (item: NavItem): item is NavTree => "children" in item

export function TenantSidebar({
  tenantId,
  tenantName,
}: {
  tenantId: string
  tenantName: string
}) {
  const pathname = usePathname()
  const base = `/admin/tenants/${tenantId}`

  const isActive = (href: string): boolean =>
    pathname === href || pathname.startsWith(`${href}/`)

  const groups: NavGroup[] = [
    {
      label: "Theme",
      items: [
        {
          label: "Theme",
          icon: PaletteIcon,
          base: `${base}/theme`,
          children: [
            { label: "Color palettes", href: `${base}/theme/colors` },
            { label: "Typography", href: `${base}/theme/typography` },
          ],
        },
      ],
    },
    {
      label: "Library",
      items: [
        { 
          label: "Templates",
          icon: LayoutTemplateIcon,
          base: `${base}/library`,
          children: [
            { label: "All Templates", href: `${base}/library/templates`},
          ]
        },
        { 
          label: "Patterns",
          icon: LayoutTemplateIcon,
          base: `${base}/library`,
          children: [
            { label: "All Patterns", href: `${base}/library/patterns`},
          ]
        },
      ],
    },
    {
      label: "Content",
      items: [
        { label: "Pages", href: `${base}/pages`, icon: FileIcon },
        { label: "Posts", href: `${base}/posts`, icon: NewspaperIcon },
      ],
    },
  ]

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="space-y-0.5 px-2 py-1.5">
          <Link
            href="/admin/tenants"
            className="text-xs text-muted-foreground hover:underline"
          >
            ← All tenants
          </Link>
          <Link
            href={base}
            className="block truncate text-sm font-semibold tracking-wide hover:underline"
          >
            {tenantName}
          </Link>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) =>
                  isTree(item) ? (
                    <CollapsibleNavItem
                      key={item.label}
                      item={item}
                      isActive={isActive}
                    />
                  ) : (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={isActive(item.href)}
                        tooltip={item.label}
                        render={<Link href={item.href} />}
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  )
}

function CollapsibleNavItem({
  item,
  isActive,
}: {
  item: NavTree
  isActive: (href: string) => boolean
}) {
  const active = isActive(item.base)
  // Controlled (not `defaultOpen`) to avoid Base UI's "default open changed"
  // warning. Seeded open when landing on a matching route; the trigger toggles
  // it thereafter.
  const [open, setOpen] = useState(active)
  const Icon = item.icon

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <SidebarMenuItem>
        <CollapsibleTrigger
          render={
            <SidebarMenuButton
              isActive={active}
              tooltip={item.label}
              className="group/collapsible data-active:bg-transparent"
            />
          }
        >
          <Icon />
          <span>{item.label}</span>
          <ChevronRightIcon className="ml-auto transition-transform group-data-panel-open/collapsible:rotate-90" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.children.map((child) => (
              <SidebarMenuSubItem key={child.href}>
                <SidebarMenuSubButton
                  isActive={isActive(child.href)}
                  render={<Link href={child.href} />}
                >
                  <span>{child.label}</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}
