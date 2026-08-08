import { useState, useEffect, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { LogOut, Sun, Moon, Loader2, RefreshCw, Wifi, WifiOff, FolderGit2 } from "lucide-react"
import { toast } from "sonner"
import DefaultLayout from "@/layouts/DefaultLayout"
import { Button } from "@/components/ui/button"
import { logout } from "@/api/api-auth"
import { useOpencodeWebSocket } from "@/hooks/useOpencodeWebSocket"
import type { WSStatus } from "@/api/wsClient"
import { OpencodeChatPane } from "@/components/opencode/OpencodeChatPane"
import { ProjectPanel } from "@/components/home/ProjectPanel"
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
    agent?: string
    variant?: string
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

interface WorktreeData {
  id: number
  branch_name: string
  status: string
  opencode_session_id?: string | null
  worktree_path: string
  project_name: string
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
  const [serverName, setServerName] = useState("")
  const [isSystemDark, setIsSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  )

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data: { status?: string; data?: { service_name?: string } }) => {
        if (data.data?.service_name) setServerName(data.data.service_name)
      })
      .catch(() => undefined)
  }, [])

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
  const [currentAgent, setCurrentAgent] = useLoggedState("build", "currentAgent")
  const [providers, setProviders] = useState<ProviderConfig[]>([])
  const [connectedProviderIDs, setConnectedProviderIDs] = useState<string[]>([])
  const [allProviders, setAllProviders] = useState<AllProviderInfo[]>([])
  const fetchProvidersLastRef = useRef(0)
  const newChatRequestedRef = useRef(false)
  const restartRequestedRef = useRef(false)
  const prevWsStatusRef = useRef<WSStatus>("disconnected")

  const [selectedWorktree, setSelectedWorktree] = useLoggedState<WorktreeData | null>(null, "selectedWorktree")
  const [selectedWorktreeId, setSelectedWorktreeId] = useLoggedState<number | null>(null, "selectedWorktreeId")
  const [selectedWorktreePath, setSelectedWorktreePath] = useLoggedState<string | null>(null, "selectedWorktreePath")

  useEffect(() => {
    const prev = prevWsStatusRef.current
    prevWsStatusRef.current = wsStatus
    if (wsStatus === "connected" && prev !== "connected") {
      statusFetchLastRef.current = 0
    }
    if (wsStatus !== "connected") {
      restartRequestedRef.current = false
    }
  }, [wsStatus])

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
        logger.debug("opencode status response", { status: data.data?.status, model: data.data?.model, variant: data.data?.variant })
        if (data.data?.status === "running") {
          setServerState("running")
          if (data.data.model) {
            const variant = data.data.variant
            setServerModel(variant ? `${data.data.model}@${variant}` : data.data.model)
          }
          if (data.data.agent) setCurrentAgent(data.data.agent)
          fetchProviders()
        } else if (data.data?.status === "stopped") {
          setServerState("stopped")
        }
      })
      .catch((err: unknown) => {
        logger.warn("Failed to fetch opencode status", { error: String(err) })
      })
  }, [wsStatus, setServerState, setServerModel, setCurrentAgent, fetchProviders])

  useEffect(() => {
    const unsub = on("server_status", (msg) => {
      const s = msg.data?.status as string | undefined
      logger.info("Received server_status", { status: s, model: msg.data?.model, variant: msg.data?.variant })
      if (s === "running") {
        setServerState("running")
        const model = msg.data?.model as string | undefined
        const variant = msg.data?.variant as string | undefined
        if (model) setServerModel(variant ? `${model}@${variant}` : model)
        if (msg.data?.agent) setCurrentAgent(msg.data.agent as string)
        fetchProviders()
      } else if (s === "stopped") {
        setServerState("stopped")
        newChatRequestedRef.current = false
        setCurrentSessionId(null)
        setSessionTitle("Chat")
        setCurrentAgent("build")
        setProviders([])
        setConnectedProviderIDs([])
        setAllProviders([])
        if (restartRequestedRef.current) {
          restartRequestedRef.current = false
          logger.info("Restarting opencode server after stop")
          setServerState("starting")
          send({ type: "start_server" })
        } else {
          setSelectedWorktree(null)
          setSelectedWorktreeId(null)
          setSelectedWorktreePath(null)
        }
      }
    })
    return unsub
  }, [on, send, setServerState, setServerModel, setCurrentSessionId, setSessionTitle, setCurrentAgent, fetchProviders, setSelectedWorktree, setSelectedWorktreeId, setSelectedWorktreePath])

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
    const unsub = on("agent_changed", (msg) => {
      const agent = msg.data?.agent as string | undefined
      logger.info("Received agent_changed", { agent })
      if (agent) {
        setCurrentAgent(agent)
        toast.success(`Agent changed to ${agent}`)
      }
    })
    return unsub
  }, [on, setCurrentAgent])

  useEffect(() => {
    if (serverState === "running" && selectedWorktreeId && !currentSessionId && wsStatus === "connected" && !newChatRequestedRef.current) {
      logger.info("Creating session for worktree", { worktree_id: selectedWorktreeId, branch: selectedWorktree?.branch_name, project: selectedWorktree?.project_name })
      send({ type: "create_session", data: { worktree_id: selectedWorktreeId } })
    }
  }, [serverState, selectedWorktreeId, currentSessionId, wsStatus, send, selectedWorktree])

  useEffect(() => {
    const unsub = on("session_created", (msg) => {
      const sid = msg.data?.session_id as string | undefined
      logger.info("Received session_created", { session_id: sid })
      if (sid) {
        newChatRequestedRef.current = false
        setCurrentSessionId(sid)
        if (selectedWorktree) {
          setSessionTitle(`${selectedWorktree.project_name} / ${selectedWorktree.branch_name}`)
        } else {
          setSessionTitle("Chat")
        }
      }
    })
    return unsub
  }, [on, setCurrentSessionId, setSessionTitle, selectedWorktree])

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

  useEffect(() => {
    if (wsStatus === "connected" && selectedWorktreeId && serverState === "stopped" && !restartRequestedRef.current) {
      logger.info("Starting opencode server", { worktree_id: selectedWorktreeId })
      setServerState("starting")
      send({ type: "start_server" })
    }
  }, [wsStatus, selectedWorktreeId, serverState, send, setServerState])

  const handleRestart = useCallback(() => {
    logger.info("User requested restart")
    restartRequestedRef.current = true
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

  const handleNewChat = useCallback(() => {
    logger.info("User requested new chat (UI clear only)")
    newChatRequestedRef.current = true
    setCurrentSessionId(null)
    setSessionTitle("Chat")
  }, [setCurrentSessionId, setSessionTitle])

  const handleSelectWorktree = useCallback(
    (worktree: WorktreeData) => {
      logger.info("Worktree selected", { branch: worktree.branch_name, project: worktree.project_name, path: worktree.worktree_path, id: worktree.id })

      if (selectedWorktreeId && selectedWorktreeId !== worktree.id) {
        newChatRequestedRef.current = false
        setCurrentSessionId(null)
        setSessionTitle("Chat")
      }

      setSelectedWorktree(worktree)
      setSelectedWorktreeId(worktree.id)
      setSelectedWorktreePath(worktree.worktree_path)
    },
    [selectedWorktreeId, setSelectedWorktree, setSelectedWorktreeId, setSelectedWorktreePath, setCurrentSessionId, setSessionTitle],
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

  const chatTitle = selectedWorktree
    ? `${selectedWorktree.project_name} / ${selectedWorktree.branch_name}`
    : sessionTitle

  return (
    <DefaultLayout>
      <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-background/50 backdrop-blur-sm shrink-0">
        <span className="text-sm font-bold text-muted-foreground truncate">
          {serverName || "Your Junior"}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground/60">
            {wsStatus === "connected" ? (
              <Wifi className="size-3 text-green-500" />
            ) : wsStatus === "connecting" ? (
              <Wifi className="size-3 text-yellow-500" />
            ) : (
              <WifiOff className="size-3 text-muted-foreground/40" />
            )}
          </span>
          {serverState === "starting" && (
            <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground/50">
              <Loader2 className="size-3 animate-spin" />
              starting...
            </span>
          )}
          {(serverState === "running" || serverState === "starting") && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={handleRestart}
              title="Restart server"
            >
              <RefreshCw className="size-3.5" />
            </Button>
          )}
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
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={handleLogout} title="Logout">
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0 gap-2 p-2">
        <div className="w-1/2 min-w-0 flex flex-col min-h-0">
          <ProjectPanel
            selectedWorktreePath={selectedWorktreePath}
            selectedWorktreeId={selectedWorktreeId}
            onSelectWorktree={handleSelectWorktree}
          />
        </div>

        <div className="w-1/2 min-w-0 flex flex-col min-h-0">
          {selectedWorktree ? (
            serverState === "running" ? (
              <OpencodeChatPane
                sessionId={currentSessionId}
                sessionTitle={chatTitle}
                send={send}
                on={on}
                providers={providers}
                allProviders={allProviders}
                connectedProviderIDs={connectedProviderIDs}
                currentModel={serverModel}
                currentAgent={currentAgent}
                onModelChange={handleModelChange}
                onSetApiKey={handleSetApiKey}
                onSelectSession={handleSwitchSession}
                onNewChat={handleNewChat}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-2 text-center">
                  <Loader2 className="size-5 animate-spin text-muted-foreground/40" />
                  <p className="font-mono text-sm text-muted-foreground/40">
                    Starting OpenCode server...
                  </p>
                </div>
              </div>
            )
          ) : (
            <div className="flex-1 flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-2 text-center">
                <FolderGit2 className="size-6 text-muted-foreground/20" />
                <p className="font-mono text-sm text-muted-foreground/40">
                  Select a project and branch to begin.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </DefaultLayout>
  )
}
