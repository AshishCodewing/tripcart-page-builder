"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useChat } from "@tanstack/ai-react"
import { fetchServerSentEvents } from "@tanstack/ai-client"
import { EventType } from "@tanstack/ai/client"
import { useEditorMaybe } from "@grapesjs/react"
import type { Editor } from "grapesjs"
import {
  ArrowUpIcon,
  Loader2,
  MessageCircleDashedIcon,
  Square,
  Trash2,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { useEditorTenantId } from "@/components/page-builder/editor-tenant-context"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip"
import { createCopilotTools } from "./copilot-tools"
import { MessageView, type MessageUsage } from "./message-parts"

const SUGGESTIONS = [
  "Create a hero section with a headline and call-to-action",
  "Add a features grid with icons",
  "Create a contact form",
  "Add testimonials section",
]

// Snapshot the GrapesJS editor state to send alongside each message: the
// page's exported HTML/CSS plus slim selection/device state — never project
// JSON, which models reason over poorly and which bloats the prompt cache.
// Kept resilient per-field so one failing accessor never drops the whole
// context. The server splits this into cache-tiered systemPrompts (see
// EditorContext in lib/ai/copilot.ts — keep the two shapes in sync).
function gatherEditorContext(
  editor: Editor | undefined
): Record<string, unknown> {
  if (!editor) return {}
  const safe = <T,>(fn: () => T): T | undefined => {
    try {
      return fn()
    } catch {
      return undefined
    }
  }
  const selected = safe(() => editor.getSelected())
  const page = safe(() => editor.Pages.getSelected())
  return {
    pageHtml: safe(() => editor.getWrapper()?.toHTML()),
    pageCss: safe(() => editor.getCss()),
    selectedComponent: selected
      ? (safe(() => ({
          id: String(selected.getId()),
          html: selected.toHTML(),
        })) ?? null)
      : null,
    selectedIds:
      safe(() => editor.getSelectedAll().map((c) => String(c.getId()))) ?? [],
    currentPage: page
      ? (safe(() => ({ id: String(page.getId()), name: page.getName() })) ??
        null)
      : null,
    devices:
      safe(() =>
        editor.Devices.getDevices().map((d) => ({
          name: d.getName(),
          width: d.get("width"),
          widthMedia: d.get("widthMedia"),
        }))
      ) ?? [],
    isNewProject:
      (safe(() => editor.getWrapper()?.components().length) ?? 0) === 0,
  }
}

/** Wallet balance for the header readout; null = unavailable (no wallet yet,
 * request failed). Cosmetic — errors never disturb the chat. */
async function fetchCredits(tenantId: string): Promise<number | null> {
  try {
    const res = await fetch(
      `/api/credits?tenantId=${encodeURIComponent(tenantId)}`
    )
    if (!res.ok) return null
    const data = (await res.json()) as { credits?: number | null }
    return typeof data.credits === "number" ? data.credits : null
  } catch {
    return null
  }
}

export default function Chat() {
  const [input, setInput] = useState("")

  // Latest editor instance, read lazily when a request fires so the server
  // always receives the current selection/project state.
  // The GrapesJS editor instance is stable once ready and its internal state is
  // read live at request time, so closing over it is enough (no latest-ref
  // needed) and keeps this resolver referentially stable.
  const editor = useEditorMaybe()
  // Billed tenant (null = unmetered, e.g. global templates); forwarded with
  // every chat request and codegen call so the server can meter usage.
  const tenantId = useEditorTenantId()
  const getConnectionOptions = useCallback(
    () => ({ body: { editorContext: gatherEditorContext(editor), tenantId } }),
    [editor, tenantId]
  )

  // Client-executed copilot tools (plan 017): the orchestrator picks a tool,
  // the handler runs here (code tools call /api/generate and apply the HTML
  // to the canvas), and only a small result re-enters the loop. The session
  // id groups this panel's code generations in Langfuse traces.
  const [codegenSessionId] = useState(() => `copilot-${crypto.randomUUID()}`)
  const tools = useMemo(
    () => createCopilotTools(() => editor, codegenSessionId, tenantId),
    [editor, codegenSessionId, tenantId]
  )

  // Remaining AI credits for the header readout. Charges post server-side as
  // each run's stream closes, so refetching when a turn finishes (or errors,
  // e.g. the 402 gate) keeps the number honest without polling.
  const [credits, setCredits] = useState<number | null>(null)
  const refreshCredits = useCallback(() => {
    if (!tenantId) return
    void fetchCredits(tenantId).then((value) => {
      if (value !== null) setCredits(value)
    })
  }, [tenantId])

  // Per-message token/cost usage, keyed by message id. The client's UIMessage
  // model doesn't carry usage, so we capture the terminal RUN_FINISHED event's
  // `usage` (via onChunk) and commit it to the finished message (via onFinish).
  const [usageByMessageId, setUsageByMessageId] = useState<
    Record<string, MessageUsage>
  >({})
  const pendingUsageRef = useRef<MessageUsage | undefined>(undefined)

  const {
    messages,
    sendMessage,
    stop,
    clear,
    isLoading,
    error,
    addToolApprovalResponse,
  } = useChat({
    // Options resolver runs per request, so each message carries a fresh editor
    // snapshot. `body` is merged into the server's `forwardedProps`.
    connection: fetchServerSentEvents("/api/chat", getConnectionOptions),
    tools,
    onChunk: (chunk) => {
      if (chunk.type === EventType.RUN_FINISHED && chunk.usage) {
        pendingUsageRef.current = chunk.usage
      }
    },
    onFinish: (message) => {
      const usage = pendingUsageRef.current
      pendingUsageRef.current = undefined
      if (usage) {
        setUsageByMessageId((prev) => ({ ...prev, [message.id]: usage }))
      }
      refreshCredits()
    },
  })

  useEffect(() => {
    if (!tenantId) return
    let cancelled = false
    void fetchCredits(tenantId).then((value) => {
      if (!cancelled && value !== null) setCredits(value)
    })
    return () => {
      cancelled = true
    }
  }, [tenantId, error])

  function handleClear() {
    pendingUsageRef.current = undefined
    setUsageByMessageId({})
    clear()
  }

  // The assistant is "thinking" between submit and its first token — i.e.
  // still loading while the newest turn is the user's. Once tokens arrive the
  // last message flips to the assistant and the shimmer gives way to text.
  const isThinking = isLoading && messages[messages.length - 1]?.role === "user"

  function submit(text: string) {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return
    setInput("")
    pendingUsageRef.current = undefined
    void sendMessage(trimmed)
  }

  return (
    <MessageScrollerProvider>
      <div className="flex h-full w-full flex-col">
        <header className="flex items-center justify-between gap-2 border-b px-2 py-2">
          {credits !== null ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <span
                    className={cn(
                      "text-xs tabular-nums",
                      credits <= 0
                        ? "font-medium text-destructive"
                        : "text-muted-foreground"
                    )}
                  >
                    {credits.toLocaleString()}
                  </span>
                }
              />
              <TooltipContent>
                {credits.toLocaleString()} AI credits remaining
              </TooltipContent>
            </Tooltip>
          ) : null}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleClear}
                >
                  <Trash2 />
                </Button>
              }
            />
            <TooltipContent>Clear Conversation</TooltipContent>
          </Tooltip>
        </header>

        <div className="min-h-0 flex-1">
          {messages.length === 0 ? (
            <Empty className="h-full px-2">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MessageCircleDashedIcon />
                </EmptyMedia>
                <EmptyTitle>AI Assistant</EmptyTitle>
                <EmptyDescription>
                  How can I help you build your project?
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <div className="grid w-full max-w-sm gap-2">
                  {SUGGESTIONS.map((s) => (
                    <Button
                      key={s}
                      variant="outline"
                      onClick={() => submit(s)}
                      className="h-auto py-2 whitespace-normal"
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              </EmptyContent>
            </Empty>
          ) : (
            <MessageScroller>
              <MessageScrollerViewport>
                <MessageScrollerContent aria-busy={isLoading} className="p-4">
                  {messages.map((m) => (
                    <MessageScrollerItem
                      key={m.id}
                      scrollAnchor={m.role === "user"}
                    >
                      <MessageView
                        message={m}
                        onApproval={addToolApprovalResponse}
                        usage={usageByMessageId[m.id]}
                      />
                    </MessageScrollerItem>
                  ))}
                  {isThinking ? (
                    <div className="shimmer px-1 text-sm text-muted-foreground">
                      Thinking…
                    </div>
                  ) : null}
                  {error ? (
                    <div className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      {/* The SSE adapter throws before the JSON body is
                          readable, so a 402 is only identifiable by status. */}
                      {error.message.includes("status: 402")
                        ? "You're out of AI credits. Contact your administrator to top up your workspace."
                        : error.message}
                    </div>
                  ) : null}
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton />
            </MessageScroller>
          )}
        </div>
        {/* Not a <form>: this panel renders inside the editor shell's outer
            <form>, and nested forms are invalid HTML. Submission is driven by
            the send button and the Enter key below. */}
        <div className="border-t bg-background p-3">
          <div>
            <InputGroup>
              <InputGroupTextarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    submit(input)
                  }
                }}
              />
              <InputGroupAddon align="block-end" className="pt-1">
                {isLoading ? (
                  <InputGroupButton
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    className="ml-auto"
                    onClick={() => stop()}
                    aria-label="Stop"
                  >
                    <Square className="size-3.5" />
                  </InputGroupButton>
                ) : (
                  <InputGroupButton
                    type="button"
                    size="icon-sm"
                    variant="default"
                    className="ml-auto"
                    disabled={!input.trim()}
                    aria-label="Send"
                    onClick={() => submit(input)}
                  >
                    <ArrowUpIcon />
                  </InputGroupButton>
                )}
                {isLoading ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : null}
              </InputGroupAddon>
            </InputGroup>
          </div>
        </div>
      </div>
    </MessageScrollerProvider>
  )
}
