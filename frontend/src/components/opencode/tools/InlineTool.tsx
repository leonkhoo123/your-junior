import { useState, type ReactNode } from "react"
import type { ToolPartData } from "@/hooks/useChatMessages"
import { statusIcon, statusColor, statusBorder, statusBg, toolPending } from "./patterns"

interface InlineToolProps {
  icon: string
  tool: string
  part: ToolPartData
  children: ReactNode
}

export function InlineTool({ icon, tool, part, children }: InlineToolProps) {
  const [errorExpanded, setErrorExpanded] = useState(false)
  const isPending = part.status === "pending"
  const isRunning = part.status === "running"
  const isCompleted = part.status === "completed"
  const isError = part.status === "error"

  return (
    <div>
      <div
        className={`flex items-center gap-2 text-xs px-2 py-0.5 rounded border ${statusBorder(part.status)} ${statusBg(part.status)}`}
      >
        {isPending ? (
          <span className="text-muted-foreground/40">~ {toolPending(tool)}</span>
        ) : (
          <>
            <span
              className={`shrink-0 w-4 text-center ${isError ? statusColor("error") : isRunning ? `${statusColor("running")} animate-pulse` : "text-muted-foreground/60"}`}
            >
              {isCompleted ? icon : isRunning ? statusIcon("running") : isError ? statusIcon("error") : icon}
            </span>
            <span
              className={
                isError
                  ? "text-red-400/70"
                  : isCompleted
                    ? "text-muted-foreground/60"
                    : ""
              }
            >
              {children}
            </span>
          </>
        )}
        {isError && part.error && (
          <button
            type="button"
            onClick={() => { setErrorExpanded(!errorExpanded) }}
            className="ml-auto flex items-center gap-0.5 text-[10px] text-red-400/50 hover:text-red-400/80 transition-colors"
          >
            {errorExpanded ? "collapse" : "error"}
          </button>
        )}
      </div>
      {isError && errorExpanded && part.error && (
        <div className="mt-1 ml-4 pl-3 border-l border-red-500/20 text-xs text-red-400/60 whitespace-pre-wrap break-words">
          {part.error}
        </div>
      )}
    </div>
  )
}
