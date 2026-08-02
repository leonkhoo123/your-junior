import type { ToolPartData } from "@/hooks/useChatMessages"
import { InlineTool } from "./InlineTool"
import { BlockTool } from "./BlockTool"
import { strVal, inputArgs, filetype } from "./patterns"
import { CodeBlock } from "../CodeBlock"
import { DiffBlock } from "../DiffBlock"

interface ToolProps {
  part: ToolPartData
}

export function WriteTool({ part }: ToolProps) {
  const filePath = strVal(part.input?.filePath)
  const content = strVal(part.input?.content)
  const formattedPath = formatPath(filePath)
  const lang = filetype(filePath)

  if (part.status === "error") {
    return (
      <InlineTool icon={"\u2190"} tool="write" part={part}>
        Write {formattedPath}
      </InlineTool>
    )
  }

  if (part.status === "completed") {
    return (
      <BlockTool
        title={filePath ? `# Wrote ${formattedPath}` : undefined}
        part={part}
      >
        {content ? (
          <CodeBlock language={lang} value={content} />
        ) : (
          <span className="text-muted-foreground/60">Write {formattedPath}</span>
        )}
      </BlockTool>
    )
  }

  return (
    <InlineTool icon={"\u2190"} tool="write" part={part}>
      Write {formattedPath}
    </InlineTool>
  )
}

export function EditTool({ part }: ToolProps) {
  const filePath = strVal(part.input?.filePath)
  const formattedPath = formatPath(filePath)
  const rawDiff = strVal(part.metadata?.diff) ?? strVal(part.output)
  const diffContent = cleanDiffMeta(rawDiff)

  if (part.status === "error") {
    return (
      <InlineTool icon={"\u2190"} tool="edit" part={part}>
        Edit {formattedPath} {inputArgs(part.input ?? {}, ["filePath", "oldString", "newString"])}
      </InlineTool>
    )
  }

  if (part.status === "completed" && diffContent && isDiffContent(diffContent)) {
    return (
      <BlockTool
        title={`\u2190 Edit ${formattedPath}`}
        part={part}
      >
        <DiffBlock
          diffText={diffContent}
          filename={filePath}
        />
      </BlockTool>
    )
  }

  return (
    <InlineTool icon={"\u2190"} tool="edit" part={part}>
      Edit {formattedPath} {inputArgs(part.input ?? {}, ["filePath", "oldString", "newString"])}
    </InlineTool>
  )
}

export function ReadTool({ part }: ToolProps) {
  const filePath = strVal(part.input?.filePath)
  const formattedPath = formatPath(filePath)

  return (
    <InlineTool icon={"\u2192"} tool="read" part={part}>
      Read {formattedPath} {inputArgs(part.input ?? {}, ["filePath"])}
    </InlineTool>
  )
}

export function ApplyPatchTool({ part }: ToolProps) {
  const filePath = strVal(part.input?.filePath) ?? strVal(part.metadata?.filepath)
  const formattedPath = formatPath(filePath)
  const rawDiff = strVal(part.metadata?.diff) ?? strVal(part.output)
  const diffContent = cleanDiffMeta(rawDiff)

  if (part.status === "error") {
    return (
      <InlineTool icon={"\u2190"} tool="apply_patch" part={part}>
        Patch {formattedPath}
      </InlineTool>
    )
  }

  if (diffContent && isDiffContent(diffContent)) {
    return (
      <BlockTool
        title={`\u2190 Patched ${formattedPath}`}
        part={part}
      >
        <DiffBlock
          diffText={diffContent}
          filename={filePath}
        />
      </BlockTool>
    )
  }

  return (
    <InlineTool icon={"\u2190"} tool="apply_patch" part={part}>
      Apply patch {formattedPath}
    </InlineTool>
  )
}

function formatPath(filePath: string | undefined): string {
  if (!filePath) return ""
  const parts = filePath.split("/")
  if (parts.length > 3) {
    return `.../${parts.slice(-2).join("/")}`
  }
  return filePath
}

export function isDiffContent(text: string): boolean {
  if (!text) return false
  const lines = text.split("\n")
  if (lines.length < 3) return false
  return lines.some((l) => /^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/.test(l))
}

function cleanDiffMeta(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  return raw
    .split("\n")
    .filter((line) => !/^(diff --git|index |--- |\+\+\+ |\\ No newline)/.test(line))
    .join("\n")
}
