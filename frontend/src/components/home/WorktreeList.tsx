import { WorktreeItem } from "./WorktreeItem"

interface WorktreeData {
  id: number
  branch_name: string
  status: string
  opencode_session_id?: string | null
  worktree_path: string
  project_name: string
}

interface WorktreeListProps {
  worktrees: WorktreeData[]
  selectedWorktreePath: string | null
  onSelectWorktree: (worktree: WorktreeData) => void
  onDeleteWorktree: (worktree: WorktreeData) => void
}

export function WorktreeList({ worktrees, selectedWorktreePath, onSelectWorktree, onDeleteWorktree }: WorktreeListProps) {
  if (worktrees.length === 0) {
    return (
      <div className="px-6 py-2">
        <span className="font-mono text-[10px] text-muted-foreground/30">
          No worktrees yet.
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-0.5 pb-1">
      {worktrees.map((wt) => (
        <WorktreeItem
          key={wt.id}
          worktree={wt}
          isSelected={selectedWorktreePath === wt.worktree_path}
          onClick={() => onSelectWorktree(wt)}
          onDelete={() => onDeleteWorktree(wt)}
        />
      ))}
    </div>
  )
}
