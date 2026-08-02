import { useState, useEffect, useCallback } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getConfig } from "@/config"
import { useArrowList } from "@/hooks/useArrowList"
import { cn } from "@/lib/utils"

interface SessionInfo {
  id: string
  title?: string
  created_at?: string
}

interface SessionSelectorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectSession: (sessionID: string, title: string) => void
}

function formatDate(raw?: string): string {
  if (!raw) return ""
  const d = new Date(raw)
  if (isNaN(d.getTime())) return raw
  return d.toLocaleString()
}

export function SessionSelectorModal({
  open,
  onOpenChange,
  onSelectSession,
}: SessionSelectorModalProps) {
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const fetchSessions = useCallback(() => {
    setLoading(true)
    setError("")
    fetch(`${getConfig().apiBaseUrl}/opencode/sessions`, { credentials: "include" })
      .then((res) => res.json().then((json: unknown) => ({ ok: res.ok, json })))
      .then(({ ok, json }) => {
        const data = json as { status: string; data?: SessionInfo[]; message?: string }
        if (ok && data.status === "success" && data.data) {
          setSessions(data.data)
        } else {
          setError(data.message ?? "Failed to load sessions")
        }
      })
      .catch((err: unknown) => {
        setError(String(err))
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (open) {
      fetchSessions()
    }
  }, [open, fetchSessions])

  const { containerRef, selectedIndex, setSelectedIndex, handleKeyDown } = useArrowList<SessionInfo>({
    items: sessions,
    enabled: open,
    onSelect: (s) => {
      onSelectSession(s.id, s.title?.trim() ?? "Chat")
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onKeyDown={handleKeyDown}
        className="sm:max-w-[520px] p-0 gap-0 border-border bg-[#0d1117]"
      >
        <DialogHeader className="px-4 py-3 border-b border-primary/10">
          <DialogTitle className="font-mono text-sm text-foreground">
            Sessions
          </DialogTitle>
        </DialogHeader>

        <div ref={containerRef} className="max-h-[400px] overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground/40" />
            </div>
          )}

          {error && (
            <div className="px-4 py-8 text-center font-mono text-xs text-red-400 flex flex-col items-center gap-3">
              <span>{error}</span>
              <button
                onClick={() => { fetchSessions() }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-primary/20 text-foreground/60 hover:bg-accent/30 transition-colors"
              >
                <RefreshCw className="size-3" />
                Retry
              </button>
            </div>
          )}

          {!loading && !error && sessions.length === 0 && (
            <div className="px-4 py-8 text-center font-mono text-xs text-muted-foreground/40">
              No sessions found
            </div>
          )}

          {!loading &&
            sessions.map((s, i) => (
              <button
                key={s.id}
                data-list-item
                onMouseEnter={() => { setSelectedIndex(i) }}
                onClick={() => {
                  onSelectSession(s.id, s.title?.trim() ?? "Chat")
                  onOpenChange(false)
                }}
                className={cn(
                  "w-full px-4 py-3 text-left font-mono text-xs border-b border-primary/5 hover:bg-accent/30 transition-colors",
                  selectedIndex === i && "bg-accent/40"
                )}
              >
                <div className="text-foreground/80 truncate">
                  {s.title?.trim() ? s.title : s.id}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-muted-foreground/40">
                  <span>{formatDate(s.created_at)}</span>
                </div>
              </button>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
