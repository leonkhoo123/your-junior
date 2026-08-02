import { type ReactNode } from "react"
import type { ToolPartData } from "@/hooks/useChatMessages"

interface BlockToolProps {
  title?: string
  part: ToolPartData
  children: ReactNode
  onClick?: () => void
}

export function BlockTool({ title, part, children, onClick }: BlockToolProps) {
  return (
    <div
      className="mt-1 border-l-2 border-muted-foreground/10 bg-muted/10 pl-3 py-1.5"
      onClick={onClick}
    >
      {title && (
        <div className="text-xs text-muted-foreground/50 pl-3 mb-1">{title}</div>
      )}
      <div className="text-xs">{children}</div>
      {part.status === "error" && part.error && (
        <div className="text-xs text-red-400/60 mt-0.5">{part.error}</div>
      )}
    </div>
  )
}
