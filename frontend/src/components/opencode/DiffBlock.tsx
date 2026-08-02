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
    <div className="my-2 border border-chat-border rounded-md overflow-hidden bg-chat-bg">
      {filename && (
        <div className="flex items-center px-3 py-1.5 bg-chat-header-bg border-b border-chat-border">
          <span className="text-xs font-mono text-chat-muted">{filename}</span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <tbody className="font-mono text-xs leading-5">
            {hasMeta && (
              <>
                {lines.filter((l) => l.type === "meta").map((line, i) => (
                  <tr key={`meta-${String(i)}`} className="bg-chat-bg">
                    <td className="text-chat-muted text-right pr-3 pl-3 select-none w-[1%] whitespace-nowrap align-top" />
                    <td className="text-chat-muted text-right pr-3 pl-3 select-none w-[1%] whitespace-nowrap align-top" />
                    <td className="px-3 align-top" colSpan={showLineNumbers ? 1 : undefined}>
                      <span className="text-chat-muted font-bold">{line.content}</span>
                    </td>
                  </tr>
                ))}
                <tr className="bg-chat-bg">
                  <td className="h-2" colSpan={3} />
                </tr>
              </>
            )}
            {lines.filter((l) => l.type !== "meta").map((line, i) => (
              <tr
                key={`diff-${String(i)}`}
                className={
                  line.type === "add"
                    ? "bg-diff-add-bg"
                    : line.type === "remove"
                      ? "bg-diff-remove-bg"
                      : line.type === "header"
                        ? "bg-diff-header-bg"
                        : ""
                }
              >
                {showLineNumbers ? (
                  <>
                    <td
                      className={
                        "text-right pr-3 pl-3 select-none w-[1%] whitespace-nowrap align-top " +
                        (line.type === "add"
                          ? "bg-diff-add-line-bg text-diff-add-line-text"
                          : line.type === "remove"
                            ? "bg-diff-remove-line-bg text-diff-remove-line-text"
                            : "text-diff-line-num-text bg-diff-line-num-bg")
                      }
                    >
                      {lineNumberPad(line.oldLineNumber)}
                    </td>
                    <td
                      className={
                        "text-right pr-3 pl-3 select-none w-[1%] whitespace-nowrap align-top " +
                        (line.type === "add"
                          ? "bg-diff-add-line-bg text-diff-add-line-text"
                          : line.type === "remove"
                            ? "bg-diff-remove-line-bg text-diff-remove-line-text"
                            : "text-diff-line-num-text bg-diff-line-num-bg")
                      }
                    >
                      {lineNumberPad(line.newLineNumber)}
                    </td>
                  </>
                ) : null}
                <td
                  className={
                    "px-3 align-top " +
                    (line.type === "header" ? "text-diff-header-text font-bold" : "")
                  }
                  colSpan={showLineNumbers ? 1 : 3}
                >
                  {line.type === "add" && (
                    <span className="text-diff-add-marker select-none mr-2 font-bold">+</span>
                  )}
                  {line.type === "remove" && (
                    <span className="text-diff-remove-marker select-none mr-2 font-bold">-</span>
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
                        ? "text-diff-add-text"
                        : line.type === "remove"
                          ? "text-diff-remove-text"
                          : "text-chat-text"
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
