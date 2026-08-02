import { useState, useEffect, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { LogOut, Sun, Moon } from "lucide-react"
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

interface AllProviderInfo {
  id: string
  name: string
}

interface ProvidersResponse {
  status: string
  data?: {
    providers: ProviderConfig[]
    default?: Record<string, string>
    connected?: string[]
    all_providers?: AllProviderInfo[]
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
  const [currentSessionId, setCurrentSessionId] = useLoggedState<string | null>(null, "currentSessionId")
  const [sessionTitle, setSessionTitle] = useLoggedState("Chat", "sessionTitle")
  const [providers, setProviders] = useState<ProviderConfig[]>([])
  const [connectedProviderIDs, setConnectedProviderIDs] = useState<string[]>([])
  const [allProviders, setAllProviders] = useState<AllProviderInfo[]>([])
  const fetchProvidersLastRef = useRef(0)

  const fetchProviders = useCallback(() => {
    const now = Date.now()
    if (now - fetchProvidersLastRef.current < 5000) {
      logger.debug("fetchProviders throttled", { elapsed: now - fetchProvidersLastRef.current })
      return
    }
    fetchProvidersLastRef.current = now
    fetch(`${getConfig().apiBaseUrl}/opencode/providers`, { credentials: "include" })
      .then((res) => res.json())
      .then((json: unknown) => {
        const data = json as ProvidersResponse
        if (data.status === "success" && data.data?.providers) {
          setProviders(data.data.providers)
          setConnectedProviderIDs(data.data.connected ?? [])
          setAllProviders(data.data.all_providers ?? [])
          logger.debug("providers loaded", { count: data.data.providers.length, connected: data.data.connected?.length, all: data.data.all_providers?.length })
        }
      })
      .catch((err: unknown) => {
        logger.warn("Failed to fetch providers", { error: String(err) })
      })
  }, [])

  const statusFetchLastRef = useRef(0)

  useEffect(() => {
    if (wsStatus !== "connected") return
    const now = Date.now()
    if (now - statusFetchLastRef.current < 5000) return
    statusFetchLastRef.current = now

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
        setCurrentSessionId(null)
        setSessionTitle("Chat")
        setProviders([])
        setConnectedProviderIDs([])
        setAllProviders([])
      }
    })
    return unsub
  }, [on, setServerState, setServerModel, setCurrentSessionId, setSessionTitle, fetchProviders])

  useEffect(() => {
    const unsub = on("model_changed", (msg) => {
      const model = msg.data?.model as string | undefined
      const variant = msg.data?.variant as string | undefined
      logger.info("Received model_changed", { model, variant })
      if (model) {
        const fullModel = variant ? `${model}@${variant}` : model
        setServerModel(fullModel)
        setCurrentSessionId(null)
        setSessionTitle("Chat")
        toast.success(`Model changed to ${model}`)
        fetchProviders()
      }
    })
    return unsub
  }, [on, setServerModel, setCurrentSessionId, setSessionTitle, fetchProviders])

  useEffect(() => {
    if (serverState === "running" && !currentSessionId && wsStatus === "connected") {
      logger.info("Auto-creating first session")
      send({ type: "create_session" })
    }
  }, [serverState, currentSessionId, wsStatus, send])

  useEffect(() => {
    const unsub = on("session_created", (msg) => {
      const sid = msg.data?.session_id as string | undefined
      logger.info("Received session_created", { session_id: sid })
      if (sid) {
        setCurrentSessionId(sid)
        setSessionTitle("Chat")
      }
    })
    return unsub
  }, [on, setCurrentSessionId, setSessionTitle])

  useEffect(() => {
    const unsub = on("session_updated", (msg) => {
      const title = msg.data?.title as string | undefined
      logger.info("Received session_updated", { title })
      if (title) {
        setSessionTitle(title)
      }
    })
    return unsub
  }, [on, setSessionTitle])

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

  const handleSwitchSession = useCallback(
    (sessionID: string, title: string) => {
      logger.info("Switching session", { sessionID, title })
      setCurrentSessionId(sessionID)
      setSessionTitle(title)
    },
    [setCurrentSessionId, setSessionTitle],
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

  const handleSetApiKey = useCallback(
    (providerID: string, apiKey: string) => {
      logger.info("Setting API key", { provider: providerID })
      send({
        type: "set_auth_key",
        data: { provider_id: providerID, api_key: apiKey },
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
        {!currentSessionId && serverState === "running" ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="font-mono text-sm text-muted-foreground/40">Creating session...</p>
          </div>
        ) : !currentSessionId ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="font-mono text-sm text-muted-foreground/40">
              Start the OpenCode server to begin.
            </p>
          </div>
        ) : (
          <OpencodeChatPane
            sessionId={currentSessionId}
            sessionTitle={sessionTitle}
            send={send}
            on={on}
            providers={providers}
            allProviders={allProviders}
            connectedProviderIDs={connectedProviderIDs}
            currentModel={serverModel}
            onModelChange={handleModelChange}
            onSetApiKey={handleSetApiKey}
            onSelectSession={handleSwitchSession}
          />
        )}
      </div>
    </DefaultLayout>
  )
}
