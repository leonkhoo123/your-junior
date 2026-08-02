import { useState, useEffect } from "react"
import type { ToolPartData } from "@/hooks/useChatMessages"

interface SubagentToolProps {
  part: ToolPartData
  onSelectSession?: (sessionID: string, title: string) => void
}

export function SubagentTool({ part, onSelectSession }: SubagentToolProps) {
  const [elapsed, setElapsed] = useState("")

  const agentType = typeof part.input?.subagent_type === "string"
    ? part.input.subagent_type
    : "agent"
  const description = typeof part.input?.description === "string"
    ? part.input.description
    : "Task"
  const background = part.metadata?.background === true
  const childSessionID = typeof part.metadata?.sessionId === "string"
    ? part.metadata.sessionId
    : undefined

  useEffect(() => {
    if (part.status !== "running" || !part.time?.start) return
    const startTime = part.time.start

    const update = () => {
      const ms = Date.now() - startTime * 1000
      const secs = Math.floor(ms / 1000)
      if (secs < 60) setElapsed(String(secs) + "s")
      else {
        const mins = Math.floor(secs / 60)
        const s = secs % 60
        setElapsed(String(mins) + "m " + String(s) + "s")
      }
    }
    update()
    const interval = setInterval(update, 1000)
    return () => { clearInterval(interval) }
  }, [part.status, part.time])

  const titleText = `${capitalize(agentType)}${background ? " (background)" : ""} — ${description}`

  const handleClick = () => {
    if (childSessionID && onSelectSession) {
      onSelectSession(childSessionID, titleText)
    }
  }

  const isClickable = childSessionID && onSelectSession

  return (
    <div
      className={`flex items-center gap-2 text-xs px-2 py-1 rounded border transition-colors ${getStatusBorder(part.status)} ${getStatusBackground(part.status)} ${isClickable ? "cursor-pointer hover:border-primary/40" : ""}`}
      onClick={handleClick}
      title={isClickable ? `Open child session ${childSessionID}` : titleText}
    >
      <span className={`shrink-0 ${getStatusColor(part.status)}`}>
        {statusIcon(part.status)}
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
              · {formatDuration(part.time.end - part.time.start)}
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

function statusIcon(status: ToolPartData["status"]): string {
  switch (status) {
    case "pending": return "○"
    case "running": return "◌"
    case "completed": return "✓"
    case "error": return "✗"
    default: return ""
  }
}

function getStatusColor(status: ToolPartData["status"]): string {
  switch (status) {
    case "pending": return "text-muted-foreground/40"
    case "running": return "text-amber-400"
    case "completed": return "text-green-500"
    case "error": return "text-red-400"
    default: return ""
  }
}

function getStatusBorder(status: ToolPartData["status"]): string {
  switch (status) {
    case "running": return "border-amber-500/20"
    case "completed": return "border-green-500/15"
    case "error": return "border-red-500/20"
    default: return "border-muted-foreground/10"
  }
}

function getStatusBackground(status: ToolPartData["status"]): string {
  switch (status) {
    case "running": return "bg-amber-500/5"
    case "completed": return "bg-green-500/5"
    case "error": return "bg-red-500/5"
    default: return "bg-muted/20"
  }
}

function formatToolCount(metadata?: Record<string, unknown>): string {
  const count = typeof metadata?.toolCalls === "number" ? metadata.toolCalls : 0
  const label = count === 1 ? "toolcall" : "toolcalls"
  return String(count) + " " + label
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return String(seconds) + "s"
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return String(mins) + "m " + String(secs) + "s"
}
