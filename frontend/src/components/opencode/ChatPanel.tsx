import { useState, useRef, useEffect, useCallback } from "react"
import { Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MessageBubble } from "@/components/opencode/MessageBubble"
import type { DisplayMessage } from "@/hooks/useChatMessages"

interface ChatPanelProps {
  sessionId: string | null
  messages: DisplayMessage[]
  onSendMessage: (text: string) => void
}

export function ChatPanel({ sessionId, messages, onSendMessage }: ChatPanelProps) {
  const [input, setInput] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`
    }
  }, [input])

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
    <>
      <div ref={listRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full p-8">
            <p className="text-muted-foreground text-sm text-center">
              {sessionId
                ? "Send a message to start chatting with OpenCode."
                : "Start the OpenCode server to begin."}
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} role={msg.role} content={msg.content} reasoning={msg.reasoning} streaming={msg.streaming} />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-border p-3 bg-card/50">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder={sessionId ? "Ask OpenCode something..." : "Start the server first..."}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!sessionId}
          />
          <Button size="icon-sm" onClick={handleSend} disabled={!sessionId || !input.trim()}>
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </>
  )
}
