import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { LogOut, Sun, Moon, Plus } from "lucide-react"
import { toast } from "sonner"
import DefaultLayout from "@/layouts/DefaultLayout"
import { Button } from "@/components/ui/button"
import { logout } from "@/api/api-auth"
import { useOpencodeWebSocket } from "@/hooks/useOpencodeWebSocket"
import { ServerControl } from "@/components/opencode/ServerControl"
import { OpencodeChatPane } from "@/components/opencode/OpencodeChatPane"
import { getConfig } from "@/config"
import { logger } from "@/utils/logger"
import { useTheme } from "@/components/theme-provider"

type ServerState = "stopped" | "starting" | "running" | "error"

interface ModelInfo {
  id: string
  name: string
  provider_id: string
  cost?: { input: number; output: number }
  variants?: Record<string, unknown>
  release_date?: string
  status?: string
}

interface ProviderConfig {
  id: string
  name: string
  models: Record<string, ModelInfo>
}

interface StatusResponse {
  status: string
  data?: {
    status: string
    model: string
  }
}

interface ProvidersResponse {
  status: string
  data?: {
    providers: ProviderConfig[]
    default?: Record<string, string>
  }
}

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
    const handler = (e: MediaQueryListEvent) => {
      setIsSystemDark(e.matches)
    }
    mq.addEventListener("change", handler)
    return () => {
      mq.removeEventListener("change", handler)
    }
  }, [])

  const { status: wsStatus, send, on } = useOpencodeWebSocket()

  const [serverState, setServerState] = useLoggedState<ServerState>("stopped", "serverState")
  const [serverModel, setServerModel] = useLoggedState("deepseek/deepseek-v4-pro", "serverModel")
  const [sessionIds, setSessionIds] = useLoggedState<string[]>([], "sessionIds")
  const [providers, setProviders] = useState<ProviderConfig[]>([])

  const fetchProviders = useCallback(() => {
    fetch(`${getConfig().apiBaseUrl}/opencode/providers`, { credentials: "include" })
      .then((res) => res.json())
      .then((json: unknown) => {
        const data = json as ProvidersResponse
        if (data.status === "success" && data.data?.providers) {
          setProviders(data.data.providers)
          logger.debug("providers loaded", { count: data.data.providers.length })
        }
      })
      .catch((err: unknown) => {
        logger.warn("Failed to fetch providers", { error: String(err) })
      })
  }, [])

  useEffect(() => {
    if (wsStatus !== "connected") return

    logger.debug("Fetching opencode status from REST API")
    fetch(`${getConfig().apiBaseUrl}/opencode/status`, { credentials: "include" })
      .then((res) => res.json())
      .then((json: unknown) => {
        const data = json as StatusResponse
        logger.debug("opencode status response", { status: data.data?.status, model: data.data?.model })
        if (data.data?.status === "running") {
          setServerState("running")
          if (data.data.model) setServerModel(data.data.model)
          fetchProviders()
        }
      })
      .catch((err: unknown) => {
        logger.warn("Failed to fetch opencode status", { error: String(err) })
      })
  }, [wsStatus, setServerState, setServerModel, fetchProviders])

  useEffect(() => {
    const unsub = on("server_status", (msg) => {
      const s = msg.data?.status as string | undefined
      logger.info("Received server_status", { status: s, model: msg.data?.model })
      if (s === "running") {
        setServerState("running")
        if (msg.data?.model) setServerModel(msg.data.model as string)
        fetchProviders()
      } else if (s === "stopped") {
        setServerState("stopped")
        setSessionIds([])
        setProviders([])
      }
    })
    return unsub
  }, [on, setServerState, setServerModel, setSessionIds, fetchProviders])

  useEffect(() => {
    const unsub = on("model_changed", (msg) => {
      const model = msg.data?.model as string | undefined
      const variant = msg.data?.variant as string | undefined
      logger.info("Received model_changed", { model, variant })
      if (model) {
        const fullModel = variant ? `${model}@${variant}` : model
        setServerModel(fullModel)
        toast.success(`Model changed to ${model}`)
        fetchProviders()
      }
    })
    return unsub
  }, [on, setServerModel, fetchProviders])

  useEffect(() => {
    if (serverState === "running" && sessionIds.length === 0 && wsStatus === "connected") {
      logger.info("Auto-creating first session")
      send({ type: "create_session" })
    }
  }, [serverState, sessionIds.length, wsStatus, send])

  useEffect(() => {
    const unsub = on("session_created", (msg) => {
      const sid = msg.data?.session_id as string | undefined
      logger.info("Received session_created", { session_id: sid })
      if (sid) {
        setSessionIds((prev) => [...prev, sid])
      }
    })
    return unsub
  }, [on, setSessionIds])

  useEffect(() => {
    const unsub = on("error", (msg) => {
      const message = msg.data?.message as string | undefined
      logger.error("Received server error", { message })
      toast.error(message ?? "Unknown error")
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

  const handleNewChat = useCallback(() => {
    logger.info("Creating new chat session")
    send({ type: "create_session" })
  }, [send])

  const handleClosePane = useCallback(
    (sid: string) => {
      setSessionIds((prev) => prev.filter((id) => id !== sid))
    },
    [setSessionIds],
  )

  const handleNavigateToChild = useCallback(
    (childSessionID: string) => {
      if (!sessionIds.includes(childSessionID)) {
        setSessionIds((prev) => [...prev, childSessionID])
      }
    },
    [sessionIds, setSessionIds],
  )

  const handleModelChange = useCallback(
    (providerID: string, modelID: string, variant?: string) => {
      const model = `${providerID}/${modelID}`
      logger.info("Changing model", { model, variant })
      send({
        type: "set_model",
        data: { model, variant },
      })
    },
    [send],
  )

  const handleLogout = () => {
    void logout().finally(() => {
      void navigate("/login")
    })
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

      <div className="flex-1 flex min-h-0">
        {sessionIds.length === 0 && serverState === "running" ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="font-mono text-sm text-muted-foreground/40">Creating session...</p>
          </div>
        ) : sessionIds.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="font-mono text-sm text-muted-foreground/40">
              Start the OpenCode server to begin.
            </p>
          </div>
        ) : sessionIds.length === 1 ? (
          <OpencodeChatPane
            sessionId={sessionIds[0]}
            send={send}
            on={on}
            label="Chat 1"
            providers={providers}
            currentModel={serverModel}
            onModelChange={handleModelChange}
            onNavigateToChild={handleNavigateToChild}
          />
        ) : (
          <div className="flex-1 flex flex-col gap-2 p-2 overflow-hidden">
            <div className="flex items-center gap-2 px-1 shrink-0">
              <span className="font-mono text-xs text-muted-foreground/50">
                {sessionIds.length} chats
              </span>
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNewChat}
                className="h-6 px-2 text-xs font-mono text-muted-foreground/50 hover:text-foreground"
              >
                <Plus className="size-3" />
                New Chat
              </Button>
            </div>
            <div className="flex-1 flex gap-2 overflow-x-auto min-h-0">
              {sessionIds.map((sid, i) => (
                <div key={sid} className="flex-1 min-w-0">
                  <OpencodeChatPane
                    sessionId={sid}
                    send={send}
                    on={on}
                    label={`Chat ${String(i + 1)}`}
                    onClose={sessionIds.length > 1 ? () => {
                      handleClosePane(sid)
                    } : undefined}
                    providers={providers}
                    currentModel={serverModel}
                    onModelChange={handleModelChange}
                    onNavigateToChild={handleNavigateToChild}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DefaultLayout>
  )
}
