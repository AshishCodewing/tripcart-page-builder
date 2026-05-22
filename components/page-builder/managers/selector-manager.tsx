"use client"

import * as React from "react"
import { SelectorsProvider, useEditor } from "@grapesjs/react"
import {
  Ban,
  Crosshair,
  MousePointer2,
  Move,
  MoreVertical,
  Plus,
  Tag,
} from "lucide-react"
import type { Component, Selector, State } from "grapesjs"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

// "Neutral" maps to the empty state in GrapesJS — `selectorManager.setState("")`
// clears the active state. Select primitive treats `""` as "no value" so we
// use a sentinel for the option's value and unwrap it before calling setState.
const NEUTRAL_STATE = ""
const NEUTRAL_VALUE = "__neutral__"

const STATE_ICON: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  "": Ban,
  hover: MousePointer2,
  focus: Crosshair,
}

type CustomSelectorsState = {
  selectors: Selector[]
  states: State[]
  selectedState: string
  targets: string[]
  addSelector: (name: string) => void
  removeSelector: (selector: Selector) => void
  setState: (name: string) => void
}

export default function SelectorManager() {
  return (
    <SelectorsProvider>
      {(props) => <SelectorManagerInner {...(props as CustomSelectorsState)} />}
    </SelectorsProvider>
  )
}

function SelectorManagerInner({
  selectors,
  states,
  selectedState,
  addSelector,
  removeSelector,
  setState,
}: CustomSelectorsState) {
  const editor = useEditor()

  // componentFirst is a runtime config — there's no event for changes, so we
  // mirror it in local state and write through to the manager on toggle.
  const [componentFirst, setComponentFirstState] = React.useState<boolean>(() =>
    editor.Selectors.getComponentFirst()
  )
  const [selectedComp, setSelectedComp] = React.useState<Component | null>(
    () => editor.getSelected() ?? null
  )
  const [adding, setAdding] = React.useState(false)
  const [draftName, setDraftName] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    const refresh = () => setSelectedComp(editor.getSelected() ?? null)
    editor.on("component:selected", refresh)
    editor.on("component:deselected", refresh)
    editor.on("component:update:attributes:id", refresh)
    return () => {
      editor.off("component:selected", refresh)
      editor.off("component:deselected", refresh)
      editor.off("component:update:attributes:id", refresh)
    }
  }, [editor])

  React.useEffect(() => {
    if (adding) inputRef.current?.focus()
  }, [adding])

  const setComponentFirst = (value: boolean) => {
    editor.Selectors.setComponentFirst(value)
    setComponentFirstState(value)
  }

  const commitDraft = () => {
    const name = draftName.trim().replace(/^\./, "")
    if (name) {
      addSelector(name)
      setComponentFirst(false)
    }
    setDraftName("")
    setAdding(false)
  }

  // States come back as Backbone models with accessor methods, so we project
  // them to plain `{ name, label }` records and prepend Neutral.
  const stateTabs = React.useMemo(
    () => [
      { name: NEUTRAL_STATE, label: "Neutral" },
      ...states.map((s) => ({ name: s.getName(), label: s.getLabel() })),
    ],
    [states]
  )

  const activeState = selectedState ?? NEUTRAL_STATE
  const compName = selectedComp?.getName() ?? ""
  const compId = selectedComp?.getId() ?? ""

  if (!selectedComp) {
    return (
      <p className="px-1 text-xs text-muted-foreground">
        Select a component to manage its classes.
      </p>
    )
  }

  return (
    <TooltipProvider delay={300}>
      <div className="flex flex-col gap-2.5">
        <ToggleGroup
          variant="pill"
          value={[activeState || NEUTRAL_VALUE]}
          onValueChange={([next]) =>
            setState(next && next !== NEUTRAL_VALUE ? next : "")
          }
          aria-label="Style state"
          className="w-full"
        >
          {stateTabs.map((s) => {
            const Icon = STATE_ICON[s.name] ?? Crosshair
            const value = s.name || NEUTRAL_VALUE
            return (
              <ToggleGroupItem
                key={value}
                value={value}
                className="min-w-0 flex-1 px-2! py-1! text-xs"
                aria-label={s.label}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                <span className="truncate">{s.label}</span>
              </ToggleGroupItem>
            )
          })}
        </ToggleGroup>

        <TargetRow
          active={!componentFirst}
          tooltip={
            selectors.length === 0
              ? "No Selectors applied"
              : "Apply Styles to Classes"
          }
          icon={<Tag className="size-3.5" aria-hidden="true" />}
          onActivate={() => setComponentFirst(false)}
          disabled={selectors.length === 0}
        >
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            {adding ? (
              <Input
                ref={inputRef}
                inputSize="sm"
                value={draftName}
                placeholder="class-name…"
                spellCheck={false}
                autoComplete="off"
                aria-label="New class name"
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={commitDraft}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    commitDraft()
                  } else if (e.key === "Escape") {
                    e.preventDefault()
                    setDraftName("")
                    setAdding(false)
                  }
                }}
                className="h-6 w-28 px-1.5 text-xs"
              />
            ) : (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-6 shrink-0 rounded-sm"
                onClick={() => setAdding(true)}
                aria-label="Add class"
              >
                <Plus className="size-3.5" aria-hidden="true" />
              </Button>
            )}

            {selectors.length === 0 && !adding ? (
              <span className="text-xs text-muted-foreground">No classes</span>
            ) : null}

            {selectors.map((sel) => (
              <ClassChip
                key={sel.toString()}
                selector={sel}
                onRename={(name) => editor.Selectors.rename(sel, name)}
                onToggleActive={() => sel.setActive(!sel.getActive())}
                onDuplicate={() => editor.Selectors.duplicateSelected(sel)}
                onRemove={() => removeSelector(sel)}
              />
            ))}
          </div>
        </TargetRow>

        <TargetRow
          active={componentFirst}
          tooltip={`Apply Styles to Component${compId ? `: #${compId}` : ""}`}
          icon={<Move className="size-3.5" aria-hidden="true" />}
          onActivate={() => setComponentFirst(true)}
        >
          <span
            className="min-w-0 truncate rounded-sm bg-muted px-1.5 py-0.5 text-xs font-medium"
            translate="no"
          >
            {compName}
          </span>
        </TargetRow>
      </div>
    </TooltipProvider>
  )
}

function TargetRow({
  active,
  tooltip,
  icon,
  onActivate,
  disabled = false,
  children,
}: {
  active: boolean
  tooltip: string
  icon: React.ReactNode
  onActivate: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      data-active={active}
      data-disabled={disabled}
      className={cn(
        "flex min-h-9 items-stretch overflow-hidden rounded-md border bg-card transition-colors duration-150 motion-reduce:transition-none",
        active && !disabled
          ? "border-primary/50"
          : "border-border/60 hover:border-border"
      )}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              onClick={onActivate}
              disabled={disabled}
              aria-pressed={active}
              aria-label={tooltip}
              className={cn(
                "flex w-9 shrink-0 items-center justify-center self-stretch border-e transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
                active && !disabled
                  ? "border-primary/50 bg-primary text-primary-foreground"
                  : "border-border/60 bg-muted/50 text-muted-foreground enabled:hover:bg-muted enabled:hover:text-foreground"
              )}
            >
              {icon}
            </button>
          }
        />
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
      <div className="flex min-w-0 flex-1 items-center gap-1.5 p-1.5">
        {children}
      </div>
    </div>
  )
}

function ClassChip({
  selector,
  onRename,
  onToggleActive,
  onDuplicate,
  onRemove,
}: {
  selector: Selector
  onRename: (name: string) => void
  onToggleActive: () => void
  onDuplicate: () => void
  onRemove: () => void
}) {
  const [renaming, setRenaming] = React.useState(false)
  const [draft, setDraft] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)
  const active = selector.getActive()

  React.useEffect(() => {
    if (renaming) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [renaming])

  const startRename = () => {
    setDraft(selector.getName())
    setRenaming(true)
  }

  const commitRename = () => {
    const name = draft.trim().replace(/^\./, "")
    if (name && name !== selector.getName()) onRename(name)
    setRenaming(false)
  }

  if (renaming) {
    return (
      <Input
        ref={inputRef}
        inputSize="sm"
        value={draft}
        spellCheck={false}
        autoComplete="off"
        aria-label={`Rename ${selector.getName()}`}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitRename}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            commitRename()
          } else if (e.key === "Escape") {
            e.preventDefault()
            setRenaming(false)
          }
        }}
        className="h-6 w-28 px-1.5 text-xs"
      />
    )
  }

  return (
    <span
      className={cn(
        "group/chip inline-flex h-6 max-w-full min-w-0 items-center rounded-sm bg-muted text-xs transition-colors duration-150 hover:bg-muted/70 motion-reduce:transition-none dark:bg-muted/50 dark:hover:bg-muted",
        !active && "line-through opacity-50"
      )}
    >
      <button
        type="button"
        onDoubleClick={startRename}
        translate="no"
        className="min-w-0 truncate rounded-l-sm ps-2 pe-1 text-start font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        aria-label={`${selector.getName()} — double-click to rename`}
      >
        {selector.getLabel()}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6 shrink-0 rounded-l-none rounded-r-sm hover:bg-transparent"
              aria-label={`Options for ${selector.getName()}`}
            />
          }
        >
          <MoreVertical className="size-3" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-32">
          <DropdownMenuItem onClick={startRename}>Rename</DropdownMenuItem>
          <DropdownMenuItem onClick={onToggleActive}>
            {active ? "Disable" : "Enable"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDuplicate}>Duplicate</DropdownMenuItem>
          <DropdownMenuItem onClick={onRemove} variant="destructive">
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  )
}
