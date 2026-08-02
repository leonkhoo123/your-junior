import type { ToolPartData } from "@/hooks/useChatMessages"
import { useState } from "react"
import { InlineTool } from "./InlineTool"
import { BlockTool } from "./BlockTool"
import { strVal, collapseToolOutput } from "./patterns"

interface ToolProps {
  part: ToolPartData
}

export function ExecuteTool({ part }: ToolProps) {
  const output = part.output?.trim() ?? ""
  const hasRuntimeError = part.metadata?.error === true
  const hasOutput = !!(output && hasRuntimeError)
  const calls = strVal(part.metadata?.toolCalls)

  return (
    <>
      <InlineTool
        icon={hasRuntimeError ? "\u2717" : part.status === "completed" ? "\u2713" : "\u2502"}
        tool="execute"
        part={part}
      >
        <span>execute{calls ? ` (${calls})` : ""}</span>
      </InlineTool>
      {hasOutput && (
        <div className="mt-0.5 pl-3">
          <ExecuteErrorOutput output={output} />
        </div>
      )}
    </>
  )
}

function ExecuteErrorOutput({ output }: { output: string }) {
  const [expanded, setExpanded] = useState(false)
  const maxLines = 4
  const maxChars = Math.max(100, maxLines * 80)
  const collapsed = collapseToolOutput(output, maxLines, maxChars)
  const limited = expanded || !collapsed.overflow ? output : collapsed.output

  return (
    <div className="pl-3 text-xs text-red-400/60 whitespace-pre-wrap break-words">
      {limited.split("\n").map((line, i) => (
        <div key={`line-${String(i)}`}>{i === 0 ? "\u21b3 " : "  "}{line}</div>
      ))}
      {collapsed.overflow && (
        <span
          className="text-muted-foreground/40 cursor-pointer select-none"
          onClick={() => { setExpanded((x) => !x) }}
        >
          {expanded ? "Show less" : "Show more..."}
        </span>
      )}
    </div>
  )
}

export function GenericTool({ part }: ToolProps) {
  const [expanded, setExpanded] = useState(false)
  const output = part.output?.trim() ?? ""
  const isCompleted = part.status === "completed"
  const hasOutput = isCompleted && output.length > 0

  const maxLines = 3
  const maxChars = Math.max(60, maxLines * 80)
  const collapsed = collapseToolOutput(output, maxLines, maxChars)
  const limited = expanded || !collapsed.overflow ? output : collapsed.output

  if (part.status === "error") {
    return (
      <InlineTool icon={"\u2699"} tool={part.tool} part={part}>
        {part.tool} {strVal(part.input?.command) ?? strVal(part.input?.url) ?? strVal(part.input?.pattern) ?? strVal(part.input?.filePath) ?? ""}
      </InlineTool>
    )
  }

  if (hasOutput) {
    return (
      <BlockTool
        title={`# ${part.tool}`}
        part={part}
        onClick={collapsed.overflow ? () => { setExpanded((x) => !x) } : undefined}
      >
        <div className="space-y-1">
          <div className="text-foreground/70 whitespace-pre-wrap break-words">{limited}</div>
          {collapsed.overflow && (
            <span className="text-muted-foreground/40 cursor-pointer select-none">
              {expanded ? "Show less" : "Show more..."}
            </span>
          )}
        </div>
      </BlockTool>
    )
  }

  return (
    <InlineTool icon={"\u2699"} tool={part.tool} part={part}>
      {part.tool} {strVal(part.input?.command) ?? strVal(part.input?.url) ?? strVal(part.input?.pattern) ?? strVal(part.input?.filePath) ?? ""}
    </InlineTool>
  )
}

export function TodoWriteTool({ part }: ToolProps) {
  const todos = part.input?.todos
  const todoArray = Array.isArray(todos) ? todos : []

  if (part.status === "error") {
    return (
      <InlineTool icon={"\u2610"} tool="todowrite" part={part}>
        Update todo list
      </InlineTool>
    )
  }

  return (
    <BlockTool title="Todo" part={part}>
      <div className="space-y-1 pl-1">
        {todoArray.length === 0 ? (
          <span className="text-muted-foreground/40 text-xs">No items</span>
        ) : (
          todoArray.map((item: { content?: string; status?: string; priority?: string }, i: number) => {
            const status = item.status ?? "pending"
            const icon = statusIcon(status)
            const color = statusColor(status)
            return (
              <div
                key={`${item.content ?? ""}-${String(i)}`}
                className="flex items-start gap-2 text-xs"
              >
                <span className={`shrink-0 mt-px ${color}`}>{icon}</span>
                <span className={status === "completed" ? "text-muted-foreground/50" : "text-foreground/80"}>
                  {item.content ?? ""}
                </span>
              </div>
            )
          })
        )}
      </div>
    </BlockTool>
  )
}

export function QuestionTool({ part }: ToolProps) {
  const questions = part.input?.questions
  const questionArray = Array.isArray(questions) ? questions : []

  return (
    <InlineTool icon="?" tool="question" part={part}>
      Asking {questionArray.length} {questionArray.length === 1 ? "question" : "questions"}
    </InlineTool>
  )
}

export function SkillTool({ part }: ToolProps) {
  const skillName = strVal(part.input?.name) ?? part.tool

  return (
    <InlineTool icon={"\u25c6"} tool="skill" part={part}>
      Skill: {skillName}
    </InlineTool>
  )
}

function statusIcon(status: string): string {
  switch (status) {
    case "completed": return "\u2713"
    case "in_progress": return "\u25cc"
    case "cancelled": return "\u2717"
    default: return "\u25cb"
  }
}

function statusColor(status: string): string {
  switch (status) {
    case "completed": return "text-green-500"
    case "in_progress": return "text-amber-400"
    case "cancelled": return "text-muted-foreground/30"
    default: return "text-muted-foreground/40"
  }
}
