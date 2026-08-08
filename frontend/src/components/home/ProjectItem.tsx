import { FolderGit2, ChevronRight, ChevronDown, Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ProjectItemProps {
  project: {
    id: number
    name: string
    git_url: string
    status: string
  }
  isExpanded: boolean
  isLoading: boolean
  onToggle: () => void
  onAddWorktree: () => void
}

export function ProjectItem({ project, isExpanded, isLoading, onToggle, onAddWorktree }: ProjectItemProps) {
  return (
    <div>
      <div
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-accent/50 cursor-pointer transition-colors group"
        onClick={onToggle}
      >
        <span className="text-muted-foreground/50 shrink-0">
          {isExpanded ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronRight className="size-3" />
          )}
        </span>
        <FolderGit2 className="size-3.5 text-muted-foreground shrink-0" />
        <span className="font-mono text-xs truncate flex-1">{project.name}</span>
        {project.status === "cloning" && (
          <Loader2 className="size-3 animate-spin text-yellow-500 shrink-0" />
        )}
        {isExpanded && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-5 w-5 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 shrink-0"
            onClick={(e) => {
              e.stopPropagation()
              onAddWorktree()
            }}
            title="New worktree"
          >
            <Plus className="size-3" />
          </Button>
        )}
      </div>

      {isExpanded && isLoading && (
        <div className="flex items-center gap-2 px-6 py-2">
          <Loader2 className="size-3 animate-spin text-muted-foreground/40" />
          <span className="font-mono text-[10px] text-muted-foreground/40">
            Loading worktrees...
          </span>
        </div>
      )}
    </div>
  )
}
