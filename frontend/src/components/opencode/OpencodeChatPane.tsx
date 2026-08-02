import { useState, useEffect } from "react"
import { useChatMessages } from "@/hooks/useChatMessages"
import { ChatPanel } from "@/components/opencode/ChatPanel"
import {
  ModelSelectorModal,
  type VariantTarget,
} from "@/components/opencode/ModelSelectorModal"
import { SessionSelectorModal } from "@/components/opencode/SessionSelectorModal"
import type { MessageHandler } from "@/hooks/useOpencodeWebSocket"

// eslint-disable-next-line @typescript-eslint/no-empty-function
const NOOP = () => {}
// eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
const NOOP_MODEL = (_providerID: string, _modelID: string, _variant?: string) => {}

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

interface AllProviderInfo {
  id: string
  name: string
}

interface OpencodeChatPaneProps {
  sessionId: string | null
  sessionTitle?: string
  send: (msg: { type: string; data?: Record<string, unknown> }) => void
  on: (type: string, handler: MessageHandler) => () => void
  providers?: ProviderConfig[]
  allProviders?: AllProviderInfo[]
  connectedProviderIDs?: string[]
  currentModel?: string
  currentAgent?: string
  onModelChange?: (providerID: string, modelID: string, variant?: string) => void
  onSetApiKey?: (providerID: string, apiKey: string) => void
  onSelectSession?: (sessionID: string, title: string) => void
  onNewChat?: () => void
}

export function OpencodeChatPane({
  sessionId,
  sessionTitle,
  send,
  on,
  providers,
  allProviders,
  connectedProviderIDs,
  currentModel,
  currentAgent,
  onModelChange,
  onSetApiKey,
  onSelectSession,
  onNewChat,
}: OpencodeChatPaneProps) {
  const { messages, addUserMessage, loadingHistory } = useChatMessages({ on, sessionId })
  const [modelModalOpen, setModelModalOpen] = useState(false)
  const [sessionModalOpen, setSessionModalOpen] = useState(false)
  const [thinkingEnabled, setThinkingEnabled] = useState(false)
  const [variantTarget, setVariantTarget] = useState<VariantTarget | null>(null)
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)
  const [creatingSession, setCreatingSession] = useState(false)

  const parsedModel = currentModel
    ? (() => {
        const atIndex = currentModel.lastIndexOf("@")
        let modelPart = currentModel
        let variant: string | undefined
        if (atIndex > 0) {
          modelPart = currentModel.slice(0, atIndex)
          variant = currentModel.slice(atIndex + 1)
        }
        const [providerID, ...rest] = modelPart.split("/")
        return { providerID, modelID: rest.join("/"), variant }
      })()
    : null

  const currentVariant = parsedModel?.variant

  const findVariantTarget = (): VariantTarget | null => {
    if (!parsedModel || !providers) return null
    const provider = providers.find((pr) => pr.id === parsedModel.providerID)
    const model = provider?.models[parsedModel.modelID]
    if (!model?.variants || Object.keys(model.variants).length === 0) return null
    return {
      providerID: parsedModel.providerID,
      modelID: parsedModel.modelID,
      modelName: model.name || parsedModel.modelID,
      variants: model.variants,
    }
  }

  const handleSendMessage = (text: string) => {
    if (!sessionId) {
      if (creatingSession) return
      setPendingMessage(text)
      setCreatingSession(true)
      send({ type: "create_session" })
      return
    }
    addUserMessage(text)
    send({
      type: "send_message",
      data: { session_id: sessionId, text },
    })
  }

  const openModelModal = (variantTargetOverride: VariantTarget | null = null) => {
    setVariantTarget(variantTargetOverride)
    setModelModalOpen(true)
  }

  const handleSlashCommand = (command: string) => {
    switch (command) {
      case "new":
        onNewChat?.()
        break
      case "thinking":
        setThinkingEnabled((prev) => !prev)
        break
      case "model":
      case "connect":
        openModelModal(null)
        break
      case "variants":
        openModelModal(findVariantTarget())
        break
      case "session":
        setSessionModalOpen(true)
        break
    }
  }

  useEffect(() => {
    if (sessionId && pendingMessage && !loadingHistory) {
      addUserMessage(pendingMessage)
      send({
        type: "send_message",
        data: { session_id: sessionId, text: pendingMessage },
      })
      setPendingMessage(null)
      setCreatingSession(false)
    }
  }, [sessionId, pendingMessage, loadingHistory, addUserMessage, send])

  const displayName = currentModel
    ? (() => {
        const p = parsedModel
        if (!p) return currentModel
        const provider = providers?.find((pr) => pr.id === p.providerID)
        const model = provider?.models[p.modelID]
        return model?.name ?? p.modelID
      })()
    : currentModel

  return (
    <div
      className="flex flex-col flex-1 min-h-0 border border-primary/10 rounded-md overflow-hidden bg-chat-bg"
      onMouseDown={(e) => {
        const target = e.target as HTMLElement
        if (target.closest("button, a, input, textarea, select, [contenteditable]")) return
        e.preventDefault()
        e.currentTarget.querySelector<HTMLInputElement>("input")?.focus()
      }}
    >
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-primary/10 bg-chat-bg shrink-0">
        <span className="font-mono text-xs font-semibold text-muted-foreground">
          {sessionTitle ?? "Chat"}
        </span>
        <div className="flex-1" />


        <ModelSelectorModal
          open={modelModalOpen}
          onOpenChange={setModelModalOpen}
          providers={providers ?? []}
          allProviders={allProviders ?? []}
          connectedProviderIDs={connectedProviderIDs ?? []}
          currentModel={currentModel ?? ""}
          onModelChange={onModelChange ?? NOOP_MODEL}
          onSetApiKey={onSetApiKey ?? NOOP}
          initialVariant={variantTarget}
        />
        <SessionSelectorModal
          open={sessionModalOpen}
          onOpenChange={setSessionModalOpen}
          onSelectSession={(sid, title) => { onSelectSession?.(sid, title) }}
        />
      </div>
      <ChatPanel
        sessionId={sessionId}
        messages={messages}
        onSendMessage={handleSendMessage}
        onSlashCommand={handleSlashCommand}
        thinkingExpanded={thinkingEnabled}
        onSelectSession={onSelectSession}
        currentAgent={currentAgent}
        currentModel={currentModel}
        currentVariant={currentVariant}
        modelDisplayName={displayName}
      />
    </div>
  )
}
