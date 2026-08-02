import type { ToolPartData } from "@/hooks/useChatMessages"
import { InlineTool } from "./InlineTool"
import { strVal, numVal } from "./patterns"

interface ToolProps {
  part: ToolPartData
}

export function WebFetchTool({ part }: ToolProps) {
  const url = strVal(part.input?.url)

  return (
    <InlineTool icon="%" tool="webfetch" part={part}>
      WebFetch {url}
    </InlineTool>
  )
}

export function WebSearchTool({ part }: ToolProps) {
  const query = strVal(part.input?.query)
  const numResults = numVal(part.metadata?.numResults)
  const provider = strVal(part.metadata?.provider)

  return (
    <InlineTool icon={"\u25c8"} tool="websearch" part={part}>
      {providerLabel(provider)} &quot;{query}&quot;{" "}
      {numResults !== undefined && (
        <span className="text-muted-foreground/40">({numResults} results)</span>
      )}
    </InlineTool>
  )
}

function providerLabel(provider: string | undefined): string {
  if (provider === "parallel") return "Parallel Web Search"
  if (provider === "exa") return "Exa Web Search"
  return "Web Search"
}
