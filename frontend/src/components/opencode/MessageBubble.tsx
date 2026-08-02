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
  streaming?: boolean
  parts?: ToolPartData[]
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
  streaming,
  parts,
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
    if (isDiffContent(content)) {
      return (
        <div className="py-1">
          <DiffBlock diffText={content} />
        </div>
      )
    }
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
            onClick={() => { setReasoningOpen(!reasoningOpen) }}
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
      <div className="text-foreground/85">
        <MarkdownRenderer content={content} />
      </div>
      {streaming && (
        <span className="inline-block w-2 h-[1.1em] bg-primary/60 ml-0.5 animate-pulse align-middle" />
      )}
    </div>
  )
}
