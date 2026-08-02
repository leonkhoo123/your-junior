import { memo } from "react"
import ReactMarkdown from "react-markdown"
import type { Components } from "react-markdown"
import { CodeBlock } from "@/components/opencode/CodeBlock"
import { DiffBlock } from "@/components/opencode/DiffBlock"

function isDiffContent(text: string): boolean {
  if (!text) return false
  const lines = text.split("\n")
  if (lines.length < 3) return false
  return lines.some((l) => /^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/.test(l))
}

function extractFilenameFromDiff(text: string): string | undefined {
  const match = /^\+\+\+ b\/(.+)$/m.exec(text)
  return match?.[1]
}

function childrenToText(children: unknown): string {
  if (typeof children === "string") return children
  if (Array.isArray(children)) return children.map(String).join("")
  return ""
}

const components: Components = {
  code({ className, children, ...props }) {
    const match = /language-(\S+)/.exec(className ?? "")
    const language = match?.[1]
    const value = childrenToText(children).replace(/\n$/, "")

    if (language === "diff" || (!language && isDiffContent(value))) {
      const filename = extractFilenameFromDiff(value)
      return <DiffBlock diffText={value} filename={filename} />
    }

    if (!language && !childrenToText(children).includes("\n")) {
      return (
        <code
          className="px-1 py-0.5 rounded bg-chat-inline-code-bg text-chat-inline-code-text text-[0.85em] font-mono break-all"
          {...props}
        >
          {children}
        </code>
      )
    }

    return <CodeBlock language={language} value={value} />
  },
  pre({ children }) {
    return <>{children}</>
  },
  p({ children }) {
    return <p className="mb-1.5 last:mb-0">{children}</p>
  },
  ul({ children }) {
    return <ul className="list-disc list-outside pl-6 mb-1.5 space-y-0.5">{children}</ul>
  },
  ol({ children }) {
    return <ol className="list-decimal list-outside pl-6 mb-1.5 space-y-0.5">{children}</ol>
  },
  li({ children }) {
    return <li className="text-foreground">{children}</li>
  },
  strong({ children }) {
    return <strong className="font-bold text-foreground">{children}</strong>
  },
  em({ children }) {
    return <em className="italic text-foreground/90">{children}</em>
  },
  a({ href, children }) {
    return (
      <a href={href} className="text-blue-600 dark:text-blue-400 underline decoration-blue-600/30 dark:decoration-blue-400/30 hover:decoration-blue-600 dark:hover:decoration-blue-400" target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    )
  },
  blockquote({ children }) {
    return (
      <blockquote className="border-l-2 border-amber-500/40 pl-3 my-2 text-muted-foreground italic">
        {children}
      </blockquote>
    )
  },
  h1({ children }) {
    return <h1 className="text-lg font-bold mb-2 mt-3 text-foreground">{children}</h1>
  },
  h2({ children }) {
    return <h2 className="text-base font-bold mb-1.5 mt-2.5 text-foreground">{children}</h2>
  },
  h3({ children }) {
    return <h3 className="text-sm font-bold mb-1.5 mt-2 text-foreground">{children}</h3>
  },
  h4({ children }) {
    return <h4 className="text-sm font-semibold mb-1 mt-2 text-foreground">{children}</h4>
  },
  hr() {
    return <hr className="my-3 border-muted-foreground/15" />
  },
  table({ children }) {
    return <table className="min-w-full border-collapse my-2 border border-chat-border rounded-md overflow-hidden">{children}</table>
  },
  thead({ children }) {
    return <thead className="bg-chat-table-header-bg">{children}</thead>
  },
  th({ children }) {
    return <th className="px-3 py-1.5 text-left text-xs font-semibold text-chat-text border-b border-chat-border">{children}</th>
  },
  td({ children }) {
    return <td className="px-3 py-1 text-xs text-chat-text border-b border-chat-border/50">{children}</td>
  },
}

interface MarkdownRendererProps {
  content: string
}

export const MarkdownRenderer = memo(function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="markdown-body">
      <ReactMarkdown components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
})
