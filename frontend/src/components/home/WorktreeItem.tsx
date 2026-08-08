import { GitBranch, Globe, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface WorktreeItemProps {
  worktree: {
    id: number
    branch_name: string
    status: string
    opencode_session_id?: string | null
    worktree_path: string
    project_name: string
  }
  isSelected: boolean
  onClick: () => void
  onDelete: () => void
}

const statusColors: Record<string, string> = {
  active: "text-green-500",
  idle: "text-muted-foreground/50",
  creating: "text-yellow-500",
  error: "text-red-500",
  removed: "text-muted-foreground/20",
}

const statusLabels: Record<string, string> = {
  active: "active",
  idle: "idle",
  creating: "creating",
  error: "error",
  removed: "removed",
}

export function WorktreeItem({ worktree, isSelected, onClick, onDelete }: WorktreeItemProps) {
  const hasSession = !!worktree.opencode_session_id
  return (
    <div
      className={`flex items-center gap-2 px-6 py-1.5 rounded-md hover:bg-accent/50 cursor-pointer transition-colors group ${
        isSelected ? "bg-accent/80 border border-primary/20" : ""
      }`}
      onClick={onClick}
    >
      <GitBranch className="size-3 text-muted-foreground shrink-0" />
      <span className="font-mono text-xs truncate flex-1">{worktree.branch_name}</span>
      <span
        className={`font-mono text-[9px] shrink-0 ${statusColors[worktree.status] ?? "text-muted-foreground/50"}`}
        title={`Status: ${statusLabels[worktree.status] ?? worktree.status}`}
      >
        {statusLabels[worktree.status] ?? worktree.status}
      </span>
      {hasSession && (
        <span title="Session active">
          <Globe className="size-2.5 text-green-500 shrink-0" />
        </span>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        className="h-5 w-5 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 shrink-0"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        title="Delete branch"
      >
        <Trash2 className="size-3" />
      </Button>
    </div>
  )
}
