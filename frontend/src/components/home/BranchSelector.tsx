import { Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useState, useEffect } from "react"
import axiosLayer from "@/api/axiosLayer"

interface BranchSelectorProps {
  projectId: number
  onSelectBranch: (branch: string) => void
  onCancel: () => void
}

export function BranchSelector({ projectId, onSelectBranch, onCancel }: BranchSelectorProps) {
  const [branches, setBranches] = useState<string[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newBranchName, setNewBranchName] = useState("")
  const [showNewBranchInput, setShowNewBranchInput] = useState(false)

  useEffect(() => {
    setLoading(true)
    axiosLayer
      .get(`/projects/${projectId}/branches`)
      .then((res) => {
        if (res.data.status === "success" && Array.isArray(res.data.data)) {
          setBranches(res.data.data)
        }
      })
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [projectId])

  const filtered = branches.filter((b) =>
    b.toLowerCase().includes(search.toLowerCase()),
  )

  const handleCreateNew = async () => {
    if (!newBranchName.trim()) return
    setCreating(true)
    try {
      await axiosLayer.post(`/projects/${projectId}/worktrees`, {
        branch: newBranchName.trim(),
      })
      onSelectBranch(newBranchName.trim())
    } catch {
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground/50" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search branches..."
          className="pl-7 font-mono text-xs h-8"
          autoFocus
        />
      </div>

      <div className="max-h-48 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="size-3 animate-spin text-muted-foreground/40" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-2 text-center">
            <span className="font-mono text-[10px] text-muted-foreground/30">
              {search ? "No branches match search" : "No remote branches found"}
            </span>
          </div>
        ) : (
          <div className="space-y-0.5">
            {filtered.map((branch) => (
              <div
                key={branch}
                className="px-3 py-1.5 rounded-md hover:bg-accent/50 cursor-pointer font-mono text-xs"
                onClick={() => onSelectBranch(branch)}
              >
                {branch}
              </div>
            ))}
          </div>
        )}
      </div>

      {showNewBranchInput ? (
        <div className="flex gap-2 items-center">
          <Input
            value={newBranchName}
            onChange={(e) => setNewBranchName(e.target.value)}
            placeholder="branch name"
            className="font-mono text-xs h-7 flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateNew()
              if (e.key === "Escape") setShowNewBranchInput(false)
            }}
            autoFocus
          />
          <Button
            size="sm"
            className="h-7 font-mono text-xs"
            onClick={handleCreateNew}
            disabled={!newBranchName.trim() || creating}
          >
            {creating ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              "Create"
            )}
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="font-mono text-xs justify-start"
          onClick={() => setShowNewBranchInput(true)}
        >
          + Create new branch
        </Button>
      )}

      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="font-mono text-xs"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
