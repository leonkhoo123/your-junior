import { useChatMessages } from "@/hooks/useChatMessages"
import { ChatPanel } from "@/components/opencode/ChatPanel"
import { ModelSelector } from "@/components/opencode/ModelSelector"
import { VariantSelector } from "@/components/opencode/VariantSelector"
import type { MessageHandler } from "@/hooks/useOpencodeWebSocket"

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

interface OpencodeChatPaneProps {
  sessionId: string | null
  send: (msg: { type: string; data?: Record<string, unknown> }) => void
  on: (type: string, handler: MessageHandler) => () => void
  label?: string
  onClose?: () => void
  providers?: ProviderConfig[]
  currentModel?: string
  onModelChange?: (providerID: string, modelID: string, variant?: string) => void
  currentVariant?: string
  onNavigateToChild?: (childSessionID: string) => void
}

export function OpencodeChatPane({
  sessionId,
  send,
  on,
  label,
  onClose,
  providers,
  currentModel,
  onModelChange,
  currentVariant,
  onNavigateToChild,
}: OpencodeChatPaneProps) {
  const { messages, addUserMessage } = useChatMessages({ on, sessionId })

  const handleSendMessage = (text: string) => {
    if (!sessionId) return
    addUserMessage(text)
    send({
      type: "send_message",
      data: { session_id: sessionId, text },
    })
  }

  const parsedModel = currentModel
    ? (() => {
        const atIndex = currentModel.lastIndexOf("@")
        let modelPart = currentModel
        if (atIndex > 0) modelPart = currentModel.slice(0, atIndex)
        const [providerID, ...rest] = modelPart.split("/")
        return { providerID, modelID: rest.join("/") }
      })()
    : null

  return (
    <div className="flex flex-col flex-1 min-h-0 border border-primary/10 rounded-md overflow-hidden bg-[#0d1117]">
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-primary/10 bg-[#0d1117] shrink-0">
        <span className="font-mono text-xs text-muted-foreground/50">
          {label ?? "Chat"}
        </span>
        <div className="flex-1" />
        {providers && providers.length > 0 && currentModel && onModelChange && (
          <>
            <ModelSelector
              providers={providers}
              currentModel={currentModel}
              onModelChange={onModelChange}
            />
            {parsedModel && (
              <VariantSelector
                providerID={parsedModel.providerID}
                modelID={parsedModel.modelID}
                providers={providers}
                currentVariant={currentVariant}
                onVariantChange={onModelChange}
              />
            )}
          </>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="font-mono text-xs text-muted-foreground/40 hover:text-red-400 transition-colors"
          >
            ✕
          </button>
        )}
      </div>
      <ChatPanel sessionId={sessionId} messages={messages} onSendMessage={handleSendMessage} onNavigateToChild={onNavigateToChild} />
    </div>
  )
}
