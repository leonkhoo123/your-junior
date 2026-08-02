import { useState } from "react"
import type { ToolPartData } from "@/hooks/useChatMessages"
import { InlineTool } from "./InlineTool"
import { BlockTool } from "./BlockTool"
import { collapseToolOutput, strVal } from "./patterns"

interface ToolProps {
  part: ToolPartData
}

export function ShellTool({ part }: ToolProps) {
  const [expanded, setExpanded] = useState(false)
  const isRunning = part.status === "running"
  const command = strVal(part.input?.command) ?? ""
  const workdir = strVal(part.input?.workdir)
  const output = part.output?.trim() ?? ""

  const maxLines = 10
  const maxChars = Math.max(200, maxLines * 80)
  const collapsed = collapseToolOutput(output, maxLines, maxChars)
  const limited = expanded || !collapsed.overflow ? output : collapsed.output

  const hasOutput = part.status === "completed" && output.length > 0
  const hasOutputBlock = part.status === "running" || hasOutput

  if (part.status === "error") {
    return (
      <InlineTool icon="$" tool="bash" part={part}>
        {command || "bash"}
      </InlineTool>
    )
  }

  if (!hasOutputBlock && part.status !== "pending") {
    return (
      <InlineTool icon="$" tool="bash" part={part}>
        {command || "bash"}
      </InlineTool>
    )
  }

  if (part.status === "pending") {
    return (
      <InlineTool icon="$" tool="bash" part={part}>
        {command || "bash"}
      </InlineTool>
    )
  }

  const title = workdir && workdir !== "."
    ? `# Running in ${workdir}`
    : undefined

  return (
    <BlockTool
      title={title}
      part={part}
      onClick={collapsed.overflow ? () => { setExpanded((x) => !x) } : undefined}
    >
      <div className="space-y-1">
        {isRunning ? (
          <span className="text-foreground/70">
            <span className="inline-block animate-pulse text-amber-400 mr-1">{"\u25cc"}</span>
            $ {command}
          </span>
        ) : (
          <span className="text-foreground/70">$ {command}</span>
        )}
        {output && (
          <div className="text-foreground/70 whitespace-pre-wrap">{limited}</div>
        )}
        {collapsed.overflow && (
          <span className="text-muted-foreground/40 cursor-pointer select-none">
            {expanded ? "Show less" : "Show more..."}
          </span>
        )}
      </div>
    </BlockTool>
  )
}
