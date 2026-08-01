import { Play, Square, Loader2, Wifi, WifiOff, Activity } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { WSStatus } from "@/api/wsClient"

type ServerState = "stopped" | "starting" | "running" | "error"

interface ServerControlProps {
  serverState: ServerState
  serverModel: string
  wsStatus: WSStatus
  onStart: () => void
  onStop: () => void
}

export function ServerControl({
  serverState,
  serverModel,
  wsStatus,
  onStart,
  onStop,
}: ServerControlProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-card/50 backdrop-blur-sm shrink-0">
      {serverState === "stopped" && (
        <Button size="sm" variant="default" onClick={onStart} disabled={wsStatus !== "connected"}>
          <Play className="size-3.5" />
          Start OpenCode
        </Button>
      )}

      {(serverState === "running" || serverState === "starting") && (
        <Button size="sm" variant="outline" onClick={onStop}>
          <Square className="size-3.5" />
          Stop
        </Button>
      )}

      <div className="flex items-center gap-2">
        {wsStatus === "connected" ? (
          <Wifi className="size-3.5 text-green-500" />
        ) : wsStatus === "connecting" ? (
          <Loader2 className="size-3.5 text-yellow-500 animate-spin" />
        ) : (
          <WifiOff className="size-3.5 text-muted-foreground" />
        )}
        <span className="text-xs text-muted-foreground">
          {wsStatus === "connected" ? "Connected" : wsStatus === "connecting" ? "Connecting..." : "Disconnected"}
        </span>
      </div>

      <div className="flex-1" />

      {serverState === "running" && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Activity className="size-3 text-green-500" />
          <span>{serverModel}</span>
        </div>
      )}

      {serverState === "starting" && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin text-yellow-500" />
          <span>Starting...</span>
        </div>
      )}
    </div>
  )
}
