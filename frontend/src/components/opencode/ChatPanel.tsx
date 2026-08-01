import { useState, useRef, useEffect } from "react"
import { MessageBubble } from "@/components/opencode/MessageBubble"
import type { DisplayMessage } from "@/hooks/useChatMessages"

interface ChatPanelProps {
  sessionId: string | null
  messages: DisplayMessage[]
  onSendMessage: (text: string) => void
  onNavigateToChild?: (childSessionID: string) => void
}

export function ChatPanel({ sessionId, messages, onSendMessage, onNavigateToChild }: ChatPanelProps) {
  const [input, setInput] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (sessionId) {
      inputRef.current?.focus()
    }
  }, [sessionId])

  const handleSend = () => {
    const text = input.trim()
    if (!text || !sessionId) return
    setInput("")
    onSendMessage(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[#0d1117]">
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="font-mono text-sm text-muted-foreground/40">
              {sessionId
                ? 'Type a message and press Enter to begin. Use Shift+Enter for newlines.'
                : 'Start the OpenCode server to begin.'}
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            role={msg.role}
            content={msg.content}
            reasoning={msg.reasoning}
            streaming={msg.streaming}
            parts={msg.parts}
            onNavigateToChild={onNavigateToChild}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-primary/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-primary/40 shrink-0">{">"}</span>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent font-mono text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none"
            placeholder={sessionId ? "ask opencode..." : "start the server first..."}
            value={input}
            onChange={(e) => { setInput(e.target.value) }}
            onKeyDown={handleKeyDown}
            disabled={!sessionId}
          />
        </div>
      </div>
    </div>
  )
}
