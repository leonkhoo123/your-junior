import { useState, useEffect } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import type { ToolPartData } from "@/hooks/useChatMessages"
import { ToolPart } from "@/components/opencode/tools"
import { MarkdownRenderer } from "@/components/opencode/MarkdownRenderer"
import { DiffBlock } from "@/components/opencode/DiffBlock"

interface MessageBubbleProps {
  role: "user" | "assistant" | "tool"
  content: string
  reasoning?: string
  parts?: ToolPartData[]
  error?: string
  thinkingExpanded?: boolean
  onSelectSession?: (sessionID: string, title: string) => void
}

function isDiffContent(text: string): boolean {
  if (!text) return false
  const lines = text.split("\n")
  if (lines.length < 3) return false
  return lines.some((l) => /^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/.test(l))
}

export function MessageBubble({
  role,
  content,
  reasoning,
  parts,
  error,
  thinkingExpanded,
  onSelectSession,
}: MessageBubbleProps) {
  const [reasoningOpen, setReasoningOpen] = useState(thinkingExpanded ?? false)

  useEffect(() => {
    if (thinkingExpanded !== undefined) {
      setReasoningOpen(thinkingExpanded)
    }
  }, [thinkingExpanded])

  if (role === "user") {
    return (
      <div className="py-2">
        <div className="flex font-mono text-sm bg-slate-200 dark:bg-chat-header-bg border-l-[3px] border-foreground/30 rounded-r-sm min-w-0">
          <span className="text-foreground whitespace-pre-wrap break-words px-3 py-2 min-w-0 w-full">
            {content}
          </span>
        </div>
      </div>
    )
  }

  if (role === "tool") {
    if (isDiffContent(content)) {
      return (
        <div className="py-1">
          <DiffBlock diffText={content} />
        </div>
      )
    }
    return (
      <div className="py-1">
        <div className="bg-muted/60 border-l-2 border-amber-500/50 pl-3 py-1.5 font-mono text-xs whitespace-pre-wrap break-words text-muted-foreground">
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
            onClick={() => { setReasoningOpen(!reasoningOpen) }}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            {reasoningOpen ? (
              <ChevronDown className="size-3" />
            ) : (
              <ChevronRight className="size-3" />
            )}
            <span className="text-xs">Thinking</span>
          </button>
          {reasoningOpen && (
            <div className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground border-l border-muted-foreground/30 pl-2">
              {reasoning}
            </div>
          )}
        </div>
      )}
      {parts && parts.length > 0 && (
        <div className="mb-2 space-y-1">
          {parts.map((part) => (
            <ToolPart
              key={part.id}
              part={part}
              onSelectSession={onSelectSession}
            />
          ))}
        </div>
      )}
      {error && (
        <div className="mb-2 border-l-2 border-red-500/30 bg-red-500/5 py-1.5 pl-3 text-xs text-red-400/80 whitespace-pre-wrap break-words">
          {error}
        </div>
      )}
      <div className="text-foreground">
        <MarkdownRenderer content={content} />
      </div>
    </div>
  )
}
