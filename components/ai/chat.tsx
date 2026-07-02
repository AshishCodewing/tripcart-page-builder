"use client"

import { useState } from "react"
import { useChat } from "@tanstack/ai-react"
import { fetchServerSentEvents } from "@tanstack/ai-client"
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
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip"
import { MessageView } from "./message-parts"

const SUGGESTIONS = [
  "Create a hero section with a headline and call-to-action",
  "Add a features grid with icons",
  "Create a contact form",
  "Add testimonials section",
]
export default function Chat() {
  const [input, setInput] = useState("")

  const {
    messages,
    sendMessage,
    stop,
    clear,
    isLoading,
    error,
    addToolApprovalResponse,
  } = useChat({
    connection: fetchServerSentEvents("/api/chat"),
  })

  // The assistant is "thinking" between submit and its first token — i.e.
  // still loading while the newest turn is the user's. Once tokens arrive the
  // last message flips to the assistant and the shimmer gives way to text.
  const isThinking = isLoading && messages[messages.length - 1]?.role === "user"

  function submit(text: string) {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return
    setInput("")
    void sendMessage(trimmed)
  }

  return (
    <MessageScrollerProvider>
      <div className="flex h-full w-full flex-col">
        <header className="flex items-center justify-between gap-2 border-b px-2 py-2">
          <Sparkles className="size-4" />
          <div className="flex-1 text-xs">AI Assistant</div>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => clear()}
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
                      {error.message}
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
