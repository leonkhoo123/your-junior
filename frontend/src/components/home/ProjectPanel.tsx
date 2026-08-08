import { useState, useEffect, useCallback } from "react"
import { GitBranch, Plus, FolderGit2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { ProjectItem } from "./ProjectItem"
import { WorktreeList } from "./WorktreeList"
import { AddProjectDialog } from "./AddProjectDialog"
import { BranchSelector } from "./BranchSelector"
import axiosLayer from "@/api/axiosLayer"

interface ProjectData {
  id: number
  name: string
  git_url: string
  status: string
}

interface WorktreeData {
  id: number
  branch_name: string
  status: string
  opencode_session_id?: string | null
  worktree_path: string
  project_name: string
}

interface ProjectPanelProps {
  selectedWorktreePath: string | null
  selectedWorktreeId: number | null
  onSelectWorktree: (worktree: WorktreeData) => void
}

export function ProjectPanel({ selectedWorktreePath, onSelectWorktree }: ProjectPanelProps) {
  const [projects, setProjects] = useState<ProjectData[]>([])
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set())
  const [worktrees, setWorktrees] = useState<Map<number, WorktreeData[]>>(new Map())
  const [loadingWorktrees, setLoadingWorktrees] = useState<Set<number>>(new Set())
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [branchSelector, setBranchSelector] = useState<{ projectId: number; projectName: string } | null>(null)
  const [projectToDelete, setProjectToDelete] = useState<ProjectData | null>(null)
  const [worktreeToDelete, setWorktreeToDelete] = useState<WorktreeData | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchProjects = useCallback(async () => {
    try {
      const res = await axiosLayer.get("/projects")
      if (res.data.status === "success" && Array.isArray(res.data.data)) {
        setProjects(res.data.data)
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const fetchWorktrees = useCallback(async (projectId: number) => {
    setLoadingWorktrees((prev) => new Set(prev).add(projectId))
    try {
      const res = await axiosLayer.get(`/projects/${projectId}/worktrees`)
      if (res.data.status === "success" && Array.isArray(res.data.data)) {
        setWorktrees((prev) => new Map(prev).set(projectId, res.data.data))
      }
    } catch {
      // ignore
    } finally {
      setLoadingWorktrees((prev) => {
        const next = new Set(prev)
        next.delete(projectId)
        return next
      })
    }
  }, [])

  const handleToggleProject = async (projectId: number) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })

    const willBeExpanded = !expandedProjects.has(projectId)
    if (willBeExpanded && !worktrees.has(projectId)) {
      fetchWorktrees(projectId)
    }
  }

  const handleSelectBranch = async (branch: string) => {
    if (!branchSelector) return

    try {
      const res = await axiosLayer.post(`/projects/${branchSelector.projectId}/worktrees`, {
        branch,
      })
      if (res.data.status === "success") {
        const projectId = branchSelector.projectId
        const currentWTs = worktrees.get(projectId) ?? []
        const newWT = res.data.data
        setWorktrees((prev) => new Map(prev).set(projectId, [...currentWTs, newWT]))
        setBranchSelector(null)
        onSelectWorktree(newWT)
      }
    } catch {
      // ignore
    }
  }

  const handleDeleteProject = async () => {
    if (!projectToDelete) return
    setDeleting(true)
    try {
      const res = await axiosLayer.delete(`/projects/${projectToDelete.id}`)
      if (res.data.status === "success") {
        toast.success(`Project "${projectToDelete.name}" removed`)
        setProjectToDelete(null)
        await fetchProjects()
      } else {
        toast.error(res.data.message ?? "Failed to delete project")
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete project"
      toast.error(msg)
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteWorktree = async () => {
    if (!worktreeToDelete) return
    setDeleting(true)
    try {
      const res = await axiosLayer.delete(`/worktrees/${worktreeToDelete.id}`)
      if (res.data.status === "success") {
        toast.success(`Branch "${worktreeToDelete.branch_name}" removed`)
        const projectId = worktreeToDelete.id
        // Find which project this worktree belongs to by scanning the worktrees map
        let parentProjectId = 0
        for (const [pid, wts] of worktrees) {
          if (wts.some((wt) => wt.id === worktreeToDelete.id)) {
            parentProjectId = pid
            break
          }
        }
        setWorktreeToDelete(null)
        if (parentProjectId) {
          await fetchWorktrees(parentProjectId)
        }
      } else {
        toast.error(res.data.message ?? "Failed to delete branch")
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete branch"
      toast.error(msg)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col h-full border border-primary/10 rounded-md overflow-hidden bg-chat-bg">
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-primary/10 bg-chat-bg shrink-0">
        <GitBranch className="size-3.5 text-muted-foreground" />
        <span className="font-mono text-xs font-semibold text-muted-foreground flex-1">
          Projects
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          onClick={() => setAddDialogOpen(true)}
          title="Add new repository"
        >
          <Plus className="size-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <FolderGit2 className="size-8 text-muted-foreground/20 mb-2" />
            <p className="font-mono text-[10px] text-muted-foreground/30 leading-relaxed max-w-[180px]">
              No projects yet. Click the + button to clone a repository.
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-0.5">
            {projects.map((project) => {
              const isExpanded = expandedProjects.has(project.id)
              return (
                <div key={project.id}>
                  <ProjectItem
                    project={project}
                    isExpanded={isExpanded}
                    isLoading={loadingWorktrees.has(project.id)}
                    onToggle={() => handleToggleProject(project.id)}
                    onAddWorktree={() =>
                      setBranchSelector({
                        projectId: project.id,
                        projectName: project.name,
                      })
                    }
                    onDelete={() => setProjectToDelete(project)}
                  />

                  {isExpanded && branchSelector && branchSelector.projectId === project.id && (
                    <div className="px-6 py-1">
                      <BranchSelector
                        projectId={project.id}
                        onSelectBranch={handleSelectBranch}
                        onCancel={() => setBranchSelector(null)}
                      />
                    </div>
                  )}

                  {isExpanded && !loadingWorktrees.has(project.id) && (
                    <WorktreeList
                      worktrees={worktrees.get(project.id) ?? []}
                      selectedWorktreePath={selectedWorktreePath}
                      onSelectWorktree={onSelectWorktree}
                      onDeleteWorktree={setWorktreeToDelete}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <AddProjectDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onProjectAdded={() => fetchProjects()}
      />

      <ConfirmDialog
        open={projectToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setProjectToDelete(null)
        }}
        title="Delete Project"
        description={`Are you sure you want to delete "${projectToDelete?.name ?? ""}"? This will permanently delete the repository and all associated branches, worktrees, and sessions.`}
        confirmLabel="Delete Project"
        variant="destructive"
        loading={deleting}
        onConfirm={handleDeleteProject}
      />

      <ConfirmDialog
        open={worktreeToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setWorktreeToDelete(null)
        }}
        title="Delete Branch"
        description={`Are you sure you want to delete branch "${worktreeToDelete?.branch_name ?? ""}"? This will delete the branch both locally and remotely, and remove all associated data.`}
        confirmLabel="Delete Branch"
        variant="destructive"
        loading={deleting}
        onConfirm={handleDeleteWorktree}
      />
    </div>
  )
}
