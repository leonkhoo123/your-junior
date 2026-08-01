import { useChatMessages } from "@/hooks/useChatMessages"
import { ChatPanel } from "@/components/opencode/ChatPanel"
import type { MessageHandler } from "@/hooks/useOpencodeWebSocket"

interface OpencodeChatPaneProps {
  sessionId: string | null
  send: (msg: { type: string; data?: Record<string, unknown> }) => void
  on: (type: string, handler: MessageHandler) => () => void
  label?: string
  onClose?: () => void
}

export function OpencodeChatPane({ sessionId, send, on, label, onClose }: OpencodeChatPaneProps) {
  const { messages, addUserMessage } = useChatMessages({ on, sessionId })

  const handleSendMessage = (text: string) => {
    if (!sessionId) return
    addUserMessage(text)
    send({
      type: "send_message",
      data: { session_id: sessionId, text },
    })
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 border border-primary/10 rounded-md overflow-hidden bg-[#0d1117]">
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-primary/10 bg-[#0d1117] shrink-0">
        <span className="font-mono text-xs text-muted-foreground/50">
          {label ?? "Chat"}
        </span>
        <div className="flex-1" />
        {onClose && (
          <button
            onClick={onClose}
            className="font-mono text-xs text-muted-foreground/40 hover:text-red-400 transition-colors"
          >
            ✕
          </button>
        )}
      </div>
      <ChatPanel sessionId={sessionId} messages={messages} onSendMessage={handleSendMessage} />
    </div>
  )
}
