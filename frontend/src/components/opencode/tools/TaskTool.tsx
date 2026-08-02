import { useState, useEffect } from "react"
import type { ToolPartData } from "@/hooks/useChatMessages"
import { strVal, numVal, formatDuration } from "./patterns"

interface TaskToolProps {
  part: ToolPartData
  onSelectSession?: (sessionID: string, title: string) => void
}

export function TaskTool({ part, onSelectSession }: TaskToolProps) {
  const [elapsed, setElapsed] = useState("")

  const agentType = strVal(part.input?.subagent_type) ?? "agent"
  const description = strVal(part.input?.description) ?? "Task"
  const background = part.metadata?.background === true
  const childSessionID = strVal(part.metadata?.sessionId)

  useEffect(() => {
    if (part.status !== "running" || !part.time?.start) return
    const startTime = part.time.start

    const update = () => {
      const ms = Date.now() - startTime * 1000
      const secs = Math.floor(ms / 1000)
      if (secs < 60) setElapsed(`${secs}s`)
      else {
        const mins = Math.floor(secs / 60)
        const s = secs % 60
        setElapsed(`${mins}m ${s}s`)
      }
    }
    update()
    const interval = setInterval(update, 1000)
    return () => { clearInterval(interval) }
  }, [part.status, part.time])

  const titleText = `${capitalize(agentType)}${background ? " (background)" : ""} \u2014 ${description}`

  const handleClick = () => {
    if (childSessionID && onSelectSession) {
      onSelectSession(childSessionID, titleText)
    }
  }

  const isClickable = !!(childSessionID && onSelectSession)

  const statusColors = (() => {
    switch (part.status) {
      case "running": return { border: "border-amber-500/20", bg: "bg-amber-500/5", color: "text-amber-400" }
      case "completed": return { border: "border-green-500/15", bg: "bg-green-500/5", color: "text-green-500" }
      case "error": return { border: "border-red-500/20", bg: "bg-red-500/5", color: "text-red-400" }
      default: return { border: "border-muted-foreground/10", bg: "bg-muted/20", color: "text-muted-foreground/40" }
    }
  })()

  return (
    <div
      className={`flex items-center gap-2 text-xs px-2 py-1 rounded border transition-colors ${statusColors.border} ${statusColors.bg} ${isClickable ? "cursor-pointer hover:border-primary/40" : ""}`}
      onClick={handleClick}
      title={isClickable ? `Open child session ${childSessionID}` : titleText}
    >
      <span className={`shrink-0 ${statusColors.color}`}>
        {statusChar(part.status)}
      </span>
      <span className="font-medium text-foreground/70">{titleText}</span>
      {part.status === "running" && elapsed && (
        <span className="text-muted-foreground/40 tabular-nums">{elapsed}</span>
      )}
      {part.status === "completed" && (
        <>
          <span className="text-muted-foreground/40">{formatToolCount(part.metadata)}</span>
          {part.time?.end && part.time.start && (
            <span className="text-muted-foreground/40 tabular-nums">
              \u00b7 {formatDuration(part.time.end - part.time.start)}
            </span>
          )}
        </>
      )}
      {part.status === "error" && part.error && (
        <span className="text-red-400/70 truncate max-w-[200px]">{part.error}</span>
      )}
    </div>
  )
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function statusChar(status: ToolPartData["status"]): string {
  switch (status) {
    case "pending": return "\u25cb"
    case "running": return "\u25cc"
    case "completed": return "\u2713"
    case "error": return "\u2717"
    default: return ""
  }
}

function formatToolCount(metadata?: Record<string, unknown>): string {
  const count = numVal(metadata?.toolCalls) ?? 0
  const label = count === 1 ? "toolcall" : "toolcalls"
  return `${count} ${label}`
}
