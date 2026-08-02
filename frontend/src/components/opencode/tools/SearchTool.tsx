import type { ToolPartData } from "@/hooks/useChatMessages"
import { InlineTool } from "./InlineTool"
import { strVal, numVal } from "./patterns"

interface ToolProps {
  part: ToolPartData
}

export function GlobTool({ part }: ToolProps) {
  const pattern = strVal(part.input?.pattern)
  const searchPath = strVal(part.input?.path)
  const count = numVal(part.metadata?.count)
  const formattedPath = formatPath(searchPath)

  return (
    <InlineTool icon={"\u2731"} tool="glob" part={part}>
      Glob &quot;{pattern}&quot;
      {formattedPath ? ` in ${formattedPath} ` : " "}
      <MatchCount count={count} />
    </InlineTool>
  )
}

export function GrepTool({ part }: ToolProps) {
  const pattern = strVal(part.input?.pattern)
  const searchPath = strVal(part.input?.path)
  const matches = numVal(part.metadata?.matches)
  const formattedPath = formatPath(searchPath)

  return (
    <InlineTool icon={"\u2731"} tool="grep" part={part}>
      Grep &quot;{pattern}&quot;
      {formattedPath ? ` in ${formattedPath} ` : " "}
      <MatchCount count={matches} />
    </InlineTool>
  )
}

function MatchCount({ count }: { count: number | undefined }) {
  if (count === undefined) return null
  return (
    <span className="text-muted-foreground/40">
      ({count} {count === 1 ? "match" : "matches"})
    </span>
  )
}

function formatPath(path: string | undefined): string {
  if (!path) return ""
  const parts = path.split("/")
  if (parts.length > 3) {
    return `.../${parts.slice(-2).join("/")}`
  }
  return path
}
