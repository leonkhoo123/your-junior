import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"

interface MessageBubbleProps {
  role: "user" | "assistant" | "tool"
  content: string
  reasoning?: string
  streaming?: boolean
}

export function MessageBubble({ role, content, reasoning, streaming }: MessageBubbleProps) {
  const [reasoningOpen, setReasoningOpen] = useState(false)

  if (role === "user") {
    return (
      <div className="py-2">
        <div className="flex gap-2 font-mono text-sm">
          <span className="text-primary/60 shrink-0">{">"}</span>
          <span className="text-foreground/80 whitespace-pre-wrap break-words">
            {content}
          </span>
        </div>
      </div>
    )
  }

  if (role === "tool") {
    return (
      <div className="py-1">
        <div className="bg-muted/30 border-l-2 border-amber-500/30 pl-3 py-1.5 font-mono text-xs whitespace-pre-wrap break-words text-muted-foreground">
          {content}
        </div>
      </div>
    )
  }

  return (
    <div className="py-2 font-mono text-sm">
      {reasoning && (
        <div className="mb-2">
          <button
            onClick={() => setReasoningOpen(!reasoningOpen)}
            className="flex items-center gap-1 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            {reasoningOpen ? (
              <ChevronDown className="size-3" />
            ) : (
              <ChevronRight className="size-3" />
            )}
            <span className="text-xs">Thinking</span>
          </button>
          {reasoningOpen && (
            <div className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground/40 border-l border-muted-foreground/15 pl-2">
              {reasoning}
            </div>
          )}
        </div>
      )}
      <div className="whitespace-pre-wrap break-words text-foreground/85">
        {content || (streaming ? "" : "")}
      </div>
      {streaming && (
        <span className="inline-block w-2 h-[1.1em] bg-primary/60 ml-0.5 animate-pulse align-middle" />
      )}
    </div>
  )
}
