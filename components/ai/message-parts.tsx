// No "use client" directive: this file has no client-only hooks — it is a
// presentational module composed inside the client-side <Chat> component, so
// it joins the client bundle via its importer rather than being a client
// *entry*. Being an entry would make the Next TS plugin demand that the
// onApproval callback be a Server Action, which it is not.

import { Brain, Check, ShieldQuestion, Wrench, X } from "lucide-react"
import { Streamdown } from "streamdown"

import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Message, MessageContent } from "@/components/ui/message"
import type { MessagePart, UIMessage } from "@tanstack/ai-client"
import type { RunFinishedEvent } from "@tanstack/ai/client"

type ApprovalResponder = (response: { id: string; approved: boolean }) => void

/**
 * Token/cost usage for one assistant turn. Sourced from the terminal
 * `RUN_FINISHED` event's `usage` field (OpenRouter reports token counts plus an
 * authoritative per-request `cost` in USD via the adapter).
 */
export type MessageUsage = NonNullable<RunFinishedEvent["usage"]>

function safeParse(value: string | undefined): unknown {
  if (!value) return undefined
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

/** Collapse an args/output object into a one-line marker description. */
function compact(value: unknown): string {
  if (value === undefined || value === null) return ""
  if (typeof value === "string") return value
  if (typeof value !== "object") return String(value)
  return Object.entries(value as Record<string, unknown>)
    .map(
      ([k, v]) =>
        `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`
    )
    .join(" · ")
}

const STATE_TO_ATTACHMENT = {
  "awaiting-input": "processing",
  "input-streaming": "processing",
  "input-complete": "processing",
  "approval-requested": "idle",
  "approval-responded": "processing",
  complete: "done",
  error: "error",
} as const

/** A tool call rendered as an attachment "marker". */
function ToolCallMarker({
  part,
  onApproval,
}: {
  part: Extract<MessagePart, { type: "tool-call" }>
  onApproval: ApprovalResponder
}) {
  const needsApproval =
    part.approval?.needsApproval && part.approval.approved === undefined
  const args = part.input ?? safeParse(part.arguments)

  let description: string
  if (needsApproval) description = "Awaiting your approval"
  else if (part.approval?.approved === false) description = "Denied"
  else if (part.output !== undefined) description = compact(part.output)
  else description = compact(args)

  const state =
    STATE_TO_ATTACHMENT[part.state as keyof typeof STATE_TO_ATTACHMENT] ??
    "processing"

  return (
    <Attachment
      data-slot="attachment"
      size="sm"
      state={state}
      className="w-full"
    >
      <AttachmentMedia>
        {needsApproval ? <ShieldQuestion /> : <Wrench />}
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>{part.name}</AttachmentTitle>
        <AttachmentDescription>
          {description || part.state}
        </AttachmentDescription>
      </AttachmentContent>
      {needsApproval && part.approval ? (
        <AttachmentActions>
          <AttachmentAction
            variant="default"
            aria-label="Approve"
            onClick={() =>
              onApproval({ id: part.approval!.id, approved: true })
            }
          >
            <Check />
          </AttachmentAction>
          <AttachmentAction
            aria-label="Deny"
            onClick={() =>
              onApproval({ id: part.approval!.id, approved: false })
            }
          >
            <X />
          </AttachmentAction>
        </AttachmentActions>
      ) : null}
    </Attachment>
  )
}

function PartView({
  part,
  isUser,
  onApproval,
}: {
  part: MessagePart
  isUser: boolean
  onApproval: ApprovalResponder
}) {
  switch (part.type) {
    case "text":
      if (!part.content) return null
      if (!isUser)
        return (
          <Streamdown className="w-fit max-w-full leading-relaxed wrap-break-word">
            {part.content}
          </Streamdown>
        )
      return (
        <Bubble variant="default">
          <BubbleContent>{part.content}</BubbleContent>
        </Bubble>
      )

    case "thinking":
      if (!part.content) return null
      return (
        <div
          data-slot="thinking"
          className="w-fit max-w-full border-l-2 border-muted-foreground/30 pl-3 text-xs text-muted-foreground italic"
        >
          <span className="mb-0.5 flex items-center gap-1 not-italic">
            <Brain className="size-3" /> reasoning
          </span>
          <span className="whitespace-pre-wrap">{part.content}</span>
        </div>
      )

    case "tool-call":
      return <ToolCallMarker part={part} onApproval={onApproval} />

    case "structured-output":
      return (
        <pre className="w-fit max-w-full overflow-auto rounded-2xl bg-muted p-3 font-mono text-[11px]">
          {JSON.stringify(part.data, null, 2)}
        </pre>
      )

    default:
      // tool-result content is already surfaced on its tool-call marker.
      return null
  }
}

/** Format OpenRouter's USD cost, keeping precision for sub-cent amounts. */
function formatCost(cost: number): string {
  return cost.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  })
}

/** Compact per-turn token/cost readout shown under an assistant message. */
function UsageLine({ usage }: { usage: MessageUsage }) {
  const { promptTokens, completionTokens, totalTokens, cost } = usage
  return (
    <div className="flex items-center gap-1.5 pl-1 text-[11px] text-muted-foreground/70 tabular-nums">
      <span
        title={`${promptTokens.toLocaleString()} in · ${completionTokens.toLocaleString()} out`}
      >
        {totalTokens.toLocaleString()} tokens
      </span>
      {typeof cost === "number" ? (
        <>
          <span aria-hidden>·</span>
          <span>{formatCost(cost)}</span>
        </>
      ) : null}
    </div>
  )
}

/** One chat turn rendered as a Message bubble with avatar. */
export function MessageView({
  message,
  onApproval,
  usage,
}: {
  message: UIMessage
  onApproval: ApprovalResponder
  usage?: MessageUsage
}) {
  const isUser = message.role === "user"
  return (
    <Message align={isUser ? "end" : "start"}>
      <MessageContent>
        {message.parts.map((part, i) => (
          <PartView
            key={i}
            part={part}
            isUser={isUser}
            onApproval={onApproval}
          />
        ))}
        {!isUser && usage ? <UsageLine usage={usage} /> : null}
      </MessageContent>
    </Message>
  )
}
