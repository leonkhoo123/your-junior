import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { LogOut, Sun, Moon } from "lucide-react"
import { toast } from "sonner"
import DefaultLayout from "@/layouts/DefaultLayout"
import { Button } from "@/components/ui/button"
import { logout } from "@/api/api-auth"
import { useOpencodeWebSocket } from "@/hooks/useOpencodeWebSocket"
import { useChatMessages } from "@/hooks/useChatMessages"
import { ServerControl } from "@/components/opencode/ServerControl"
import { ChatPanel } from "@/components/opencode/ChatPanel"
import { getConfig } from "@/config"
import { logger } from "@/utils/logger"
import { useTheme } from "@/components/theme-provider"

type ServerState = "stopped" | "starting" | "running" | "error"

function useLoggedState<T>(initial: T, label: string): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [val, setVal] = useState<T>(initial)
  const setter: React.Dispatch<React.SetStateAction<T>> = (action) => {
    setVal((prev) => {
      const next = typeof action === "function" ? (action as (prev: T) => T)(prev) : action
      if (prev !== next) {
        logger.debug(`[State] ${label}: ${String(prev)} -> ${String(next)}`)
      }
      return next
    })
  }
  return [val, setter]
}

export default function HomePage() {
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const [isSystemDark, setIsSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  )

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = (e: MediaQueryListEvent) => setIsSystemDark(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  const { status: wsStatus, send, on } = useOpencodeWebSocket()

  const [serverState, setServerState] = useLoggedState<ServerState>("stopped", "serverState")
  const [serverModel, setServerModel] = useLoggedState("deepseek/deepseek-v4-pro", "serverModel")
  const [sessionId, setSessionId] = useLoggedState<string | null>(null, "sessionId")

  const { messages, addUserMessage } = useChatMessages({ on, sessionId })

  useEffect(() => {
    if (wsStatus !== "connected") return

    logger.debug("Fetching opencode status from REST API")
    fetch(`${getConfig().apiBaseUrl}/opencode/status`, { credentials: "include" })
      .then((res) => res.json())
      .then((json) => {
        logger.debug("opencode status response", { status: json.data?.status, model: json.data?.model })
        if (json.data?.status === "running") {
          setServerState("running")
          if (json.data.model) setServerModel(json.data.model)
        }
      })
      .catch((err) => {
        logger.warn("Failed to fetch opencode status", { error: String(err) })
      })
  }, [wsStatus, setServerState, setServerModel])

  useEffect(() => {
    const unsub = on("server_status", (msg) => {
      const s = msg.data?.status as string | undefined
      logger.info("Received server_status", { status: s, model: msg.data?.model })
      if (s === "running") {
        setServerState("running")
        if (msg.data?.model) setServerModel(msg.data.model as string)
      } else if (s === "stopped") {
        setServerState("stopped")
        setSessionId(null)
      }
    })
    return unsub
  }, [on, setServerState, setServerModel, setSessionId])

  useEffect(() => {
    if (serverState === "running" && !sessionId && wsStatus === "connected") {
      logger.info("Auto-creating session")
      send({ type: "create_session" })
    }
  }, [serverState, sessionId, wsStatus, send])

  useEffect(() => {
    const unsub = on("session_created", (msg) => {
      const sid = msg.data?.session_id as string | undefined
      logger.info("Received session_created", { session_id: sid })
      if (sid) {
        setSessionId(sid)
      }
    })
    return unsub
  }, [on, setSessionId])

  useEffect(() => {
    const unsub = on("error", (msg) => {
      const message = (msg.data?.message as string) || "Unknown error"
      logger.error("Received server error", { message })
      toast.error(message)
    })
    return unsub
  }, [on])

  const handleStart = useCallback(() => {
    logger.info("User requested start_server")
    setServerState("starting")
    send({ type: "start_server" })
  }, [send, setServerState])

  const handleStop = useCallback(() => {
    logger.info("User requested stop_server")
    send({ type: "stop_server" })
  }, [send])

  const handleSendMessage = useCallback(
    (text: string) => {
      logger.info("User sending message", { session_id: sessionId, textLen: text.length })
      if (sessionId) {
        addUserMessage(text)
        send({
          type: "send_message",
          data: { session_id: sessionId, text },
        })
      } else {
        logger.warn("Cannot send message: no session_id")
      }
    },
    [sessionId, send, addUserMessage],
  )

  const handleLogout = () => {
    void logout().finally(() => navigate("/login"))
  }

  return (
    <DefaultLayout>
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => {
            if (theme === "system") {
              setTheme(isSystemDark ? "light" : "dark")
            } else {
              setTheme(theme === "dark" ? "light" : "dark")
            }
          }}
          title="Toggle theme"
        >
          {theme === "dark" || (theme === "system" && isSystemDark) ? (
            <Moon className="h-[1.2rem] w-[1.2rem]" />
          ) : (
            <Sun className="h-[1.2rem] w-[1.2rem]" />
          )}
        </Button>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="size-4" />
          Logout
        </Button>
      </div>

      <ServerControl
        serverState={serverState}
        serverModel={serverModel}
        wsStatus={wsStatus}
        onStart={handleStart}
        onStop={handleStop}
      />

      <ChatPanel sessionId={sessionId} messages={messages} onSendMessage={handleSendMessage} />
    </DefaultLayout>
  )
}
