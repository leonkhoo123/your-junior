import { useState } from "react"
import { User, Bot, Wrench, ChevronDown, ChevronRight } from "lucide-react"

interface MessageBubbleProps {
  role: "user" | "assistant" | "tool"
  content: string
  reasoning?: string
  streaming?: boolean
}

export function MessageBubble({ role, content, reasoning, streaming }: MessageBubbleProps) {
  const isUser = role === "user"
  const isTool = role === "tool"
  const [reasoningOpen, setReasoningOpen] = useState(false)

  return (
    <div className={`flex gap-3 px-4 py-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
          isUser
            ? "bg-primary/10 text-primary"
            : isTool
              ? "bg-amber-500/10 text-amber-500"
              : "bg-muted text-muted-foreground"
        }`}
      >
        {isUser ? <User className="size-4" /> : isTool ? <Wrench className="size-4" /> : <Bot className="size-4" />}
      </div>

      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground"
            : isTool
              ? "bg-amber-500/10 text-foreground border border-amber-500/20"
              : "bg-muted text-foreground"
        }`}
      >
        {reasoning && (
          <div className="mb-2">
            <button
              onClick={() => setReasoningOpen(!reasoningOpen)}
              className="flex items-center gap-1 text-xs text-muted-foreground/70 hover:text-muted-foreground transition-colors"
            >
              {reasoningOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
              <span>Thinking</span>
            </button>
            {reasoningOpen && (
              <div className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground/50 border-l-2 border-muted-foreground/20 pl-2">
                {reasoning}
              </div>
            )}
          </div>
        )}
        <div className="whitespace-pre-wrap break-words">
          {content || (streaming && !reasoning ? "..." : "")}
        </div>
        {streaming && content && (
          <span className="inline-block w-1.5 h-4 bg-foreground/50 ml-0.5 animate-pulse align-middle" />
        )}
      </div>
    </div>
  )
}
