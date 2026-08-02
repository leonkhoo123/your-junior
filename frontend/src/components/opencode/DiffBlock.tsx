import { useMemo } from "react"

interface DiffLine {
  type: "add" | "remove" | "context" | "header" | "meta"
  content: string
  oldLineNumber?: number
  newLineNumber?: number
}

function parseUnifiedDiff(diffText: string): DiffLine[] {
  const lines = diffText.split("\n")
  const result: DiffLine[] = []
  let oldLine = 0
  let newLine = 0

  const hunkHeaderRe = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/

  for (const line of lines) {
    if (line.startsWith("diff --git") || line.startsWith("index ") || line.startsWith("---") || line.startsWith("+++") || line.startsWith("new file") || line.startsWith("deleted file") || line.startsWith("rename ")) {
      result.push({ type: "meta", content: line })
      continue
    }

    const hunkMatch = hunkHeaderRe.exec(line)
    if (hunkMatch) {
      oldLine = parseInt(hunkMatch[1], 10)
      newLine = parseInt(hunkMatch[3], 10)
      result.push({ type: "header", content: line })
      continue
    }

    if (line.startsWith("+")) {
      result.push({ type: "add", content: line.slice(1), newLineNumber: newLine++ })
    } else if (line.startsWith("-")) {
      result.push({ type: "remove", content: line.slice(1), oldLineNumber: oldLine++ })
    } else if (line.startsWith(" ") || line === "") {
      result.push({
        type: "context",
        content: line.startsWith(" ") ? line.slice(1) : "",
        oldLineNumber: oldLine++,
        newLineNumber: newLine++,
      })
    } else if (line.startsWith("\\")) {
      result.push({ type: "meta", content: line })
    }
  }

  return result
}

interface DiffBlockProps {
  diffText: string
  filename?: string
  showLineNumbers?: boolean
}

function lineNumberPad(num: number | undefined): string {
  if (num === undefined) return ""
  return String(num)
}

export function DiffBlock({ diffText, filename, showLineNumbers = true }: DiffBlockProps) {
  const lines = useMemo(() => parseUnifiedDiff(diffText), [diffText])

  if (lines.length === 0) {
    return (
      <div className="my-2 p-3 border border-muted-foreground/15 rounded-md bg-muted/10">
        <span className="text-xs text-muted-foreground/60 font-mono">No diff content</span>
      </div>
    )
  }

  const hasMeta = lines.some((l) => l.type === "meta")

  return (
    <div className="my-2 border border-[#30363d] rounded-md overflow-hidden bg-[#0d1117]">
      {filename && (
        <div className="flex items-center px-3 py-1.5 bg-[#161b22] border-b border-[#30363d]">
          <span className="text-xs font-mono text-[#8b949e]">{filename}</span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <tbody className="font-mono text-xs leading-5">
            {hasMeta && (
              <>
                {lines.filter((l) => l.type === "meta").map((line, i) => (
                  <tr key={`meta-${String(i)}`} className="bg-[#0d1117]">
                    <td className="text-[#8b949e] text-right pr-3 pl-3 select-none w-[1%] whitespace-nowrap align-top" />
                    <td className="text-[#8b949e] text-right pr-3 pl-3 select-none w-[1%] whitespace-nowrap align-top" />
                    <td className="px-3 align-top" colSpan={showLineNumbers ? 1 : undefined}>
                      <span className="text-[#8b949e] font-bold">{line.content}</span>
                    </td>
                  </tr>
                ))}
                <tr className="bg-[#0d1117]">
                  <td className="h-2" colSpan={3} />
                </tr>
              </>
            )}
            {lines.filter((l) => l.type !== "meta").map((line, i) => (
              <tr
                key={`diff-${String(i)}`}
                className={
                  line.type === "add"
                    ? "bg-[#12261e]"
                    : line.type === "remove"
                      ? "bg-[#2d171b]"
                      : line.type === "header"
                        ? "bg-[#1b2a3a]"
                        : ""
                }
              >
                {showLineNumbers ? (
                  <>
                    <td
                      className={
                        "text-right pr-3 pl-3 select-none w-[1%] whitespace-nowrap align-top " +
                        (line.type === "add"
                          ? "bg-[#1a3a2e] text-[#7ee787]"
                          : line.type === "remove"
                            ? "bg-[#3d1f26] text-[#f7788b]"
                            : "text-[#484f58] bg-[#161b22]")
                      }
                    >
                      {lineNumberPad(line.oldLineNumber)}
                    </td>
                    <td
                      className={
                        "text-right pr-3 pl-3 select-none w-[1%] whitespace-nowrap align-top " +
                        (line.type === "add"
                          ? "bg-[#1a3a2e] text-[#7ee787]"
                          : line.type === "remove"
                            ? "bg-[#3d1f26] text-[#f7788b]"
                            : "text-[#484f58] bg-[#161b22]")
                      }
                    >
                      {lineNumberPad(line.newLineNumber)}
                    </td>
                  </>
                ) : null}
                <td
                  className={
                    "px-3 align-top " +
                    (line.type === "header" ? "text-[#79c0ff] font-bold" : "")
                  }
                  colSpan={showLineNumbers ? 1 : 3}
                >
                  {line.type === "add" && (
                    <span className="text-[#3fb950] select-none mr-2 font-bold">+</span>
                  )}
                  {line.type === "remove" && (
                    <span className="text-[#f85149] select-none mr-2 font-bold">-</span>
                  )}
                  {line.type === "header" && (
                    <span className="select-none mr-2" />
                  )}
                  {(line.type === "context" || line.type === "header") && (
                    <span className="select-none mr-2" />
                  )}
                  <span
                    className={
                      line.type === "add"
                        ? "text-[#d2f3d2]"
                        : line.type === "remove"
                          ? "text-[#fdd2d7]"
                          : "text-[#c9d1d9]"
                    }
                  >
                    {line.content}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
