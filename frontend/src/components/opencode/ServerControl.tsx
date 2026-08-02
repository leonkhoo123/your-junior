import { Play, Square, Loader2, Wifi, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { WSStatus } from "@/api/wsClient"

type ServerState = "stopped" | "starting" | "running" | "error"

interface ServerControlProps {
  serverState: ServerState
  wsStatus: WSStatus
  onStart: () => void
  onStop: () => void
}

export function ServerControl({
  serverState,
  wsStatus,
  onStart,
  onStop,
}: ServerControlProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-primary/10 bg-chat-bg shrink-0 font-mono text-xs">
      {serverState === "stopped" && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onStart}
          disabled={wsStatus !== "connected"}
          className="h-7 px-2.5 text-xs font-mono text-green-400 hover:text-green-300 hover:bg-green-400/10"
        >
          <Play className="size-3" />
          Start
        </Button>
      )}

      {(serverState === "running" || serverState === "starting") && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onStop}
          className="h-7 px-2.5 text-xs font-mono text-red-400 hover:text-red-300 hover:bg-red-400/10"
        >
          <Square className="size-3" />
          Stop
        </Button>
      )}

      <div className="flex items-center gap-1.5 text-muted-foreground/60">
        {wsStatus === "connected" ? (
          <Wifi className="size-3 text-green-500" />
        ) : wsStatus === "connecting" ? (
          <Wifi className="size-3 text-yellow-500" />
        ) : (
          <WifiOff className="size-3 text-muted-foreground/40" />
        )}
        <span>{wsStatus === "connected" ? "ws" : wsStatus === "connecting" ? "..." : "off"}</span>
      </div>

      <div className="flex-1" />


      {serverState === "starting" && (
        <span className="flex items-center gap-1 text-muted-foreground/50">
          <Loader2 className="size-3 animate-spin" />
          starting...
        </span>
      )}
    </div>
  )
}
