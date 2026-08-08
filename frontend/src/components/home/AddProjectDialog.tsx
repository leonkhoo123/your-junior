import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GitBranch, Loader2, CheckCircle2, XCircle } from "lucide-react"
import { useState } from "react"
import axiosLayer from "@/api/axiosLayer"

interface AddProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onProjectAdded: () => void
}

type CloneState = "idle" | "cloning" | "success" | "error"

export function AddProjectDialog({ open, onOpenChange, onProjectAdded }: AddProjectDialogProps) {
  const [gitUrl, setGitUrl] = useState("")
  const [cloneState, setCloneState] = useState<CloneState>("idle")
  const [cloneMessage, setCloneMessage] = useState("")

  const handleClone = async () => {
    if (!gitUrl.trim()) return
    setCloneState("cloning")
    setCloneMessage("Cloning repository...")

    try {
      const res = await axiosLayer.post("/projects", { git_url: gitUrl.trim() })
      if (res.data.status === "success") {
        setCloneState("success")
        setCloneMessage(`Cloned ${res.data.data?.name ?? "project"}`)
        onProjectAdded()
      } else {
        setCloneState("error")
        setCloneMessage(res.data.message ?? "Clone failed")
      }
    } catch (err: unknown) {
      setCloneState("error")
      if (err && typeof err === "object" && "response" in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } }
        setCloneMessage(axiosErr.response?.data?.message ?? "Clone failed")
      } else {
        setCloneMessage("Clone failed")
      }
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setGitUrl("")
      setCloneState("idle")
      setCloneMessage("")
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">Clone Repository</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            Paste a Git repository URL to clone into the project directory.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Input
            value={gitUrl}
            onChange={(e) => {
              setGitUrl(e.target.value)
              if (cloneState !== "idle") {
                setCloneState("idle")
                setCloneMessage("")
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && cloneState !== "cloning") handleClone()
            }}
            placeholder="https://github.com/user/repo.git"
            className="font-mono text-xs"
            disabled={cloneState === "cloning"}
            autoFocus
          />

          <Button
            onClick={handleClone}
            disabled={!gitUrl.trim() || cloneState === "cloning"}
            className="w-full font-mono text-xs"
            size="sm"
          >
            {cloneState === "cloning" ? (
              <>
                <Loader2 className="size-3.5 animate-spin mr-1.5" />
                Cloning...
              </>
            ) : (
              <>
                <GitBranch className="size-3.5 mr-1.5" />
                Clone
              </>
            )}
          </Button>

          {cloneState !== "idle" && (
            <div
              className={`flex items-start gap-2 p-3 rounded-md border text-xs font-mono ${
                cloneState === "cloning"
                  ? "border-yellow-500/30 bg-yellow-500/5 text-yellow-400"
                  : cloneState === "success"
                    ? "border-green-500/30 bg-green-500/5 text-green-400"
                    : "border-red-500/30 bg-red-500/5 text-red-400"
              }`}
            >
              {cloneState === "cloning" ? (
                <Loader2 className="size-3.5 animate-spin shrink-0 mt-0.5" />
              ) : cloneState === "success" ? (
                <CheckCircle2 className="size-3.5 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="size-3.5 shrink-0 mt-0.5" />
              )}
              <span>{cloneMessage}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
