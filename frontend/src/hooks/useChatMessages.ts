import { useState, useRef, useEffect, useCallback } from "react"
import { logger } from "@/utils/logger"
import type { MessageHandler } from "@/hooks/useOpencodeWebSocket"

export interface DisplayMessage {
  id: string
  role: "user" | "assistant" | "tool"
  content: string
  reasoning: string
  streaming: boolean
}

interface UseChatMessagesOptions {
  on: (type: string, handler: MessageHandler) => () => void
  sessionId: string | null
}

export function useChatMessages({ on, sessionId }: UseChatMessagesOptions) {
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const streamingIdRef = useRef<string | null>(null)

  const addUserMessage = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
        reasoning: "",
        streaming: false,
      },
    ])
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    streamingIdRef.current = null
  }, [])

  useEffect(() => {
    const unsub = on("chat_message", (msg) => {
      const text = typeof msg.data?.text === "string" ? msg.data.text : ""
      const reasoning = typeof msg.data?.reasoning === "string" ? msg.data.reasoning : ""

      if (!text && !reasoning) return

      if (!streamingIdRef.current) {
        streamingIdRef.current = `msg-${Date.now()}`
      }

      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === streamingIdRef.current)
        if (idx !== -1) {
          const updated = [...prev]
          updated[idx] = {
            ...updated[idx],
            content: text || updated[idx].content,
            reasoning: reasoning || updated[idx].reasoning,
            streaming: true,
          }
          return updated
        }
        return [...prev, { id: streamingIdRef.current!, role: "assistant", content: text, reasoning, streaming: true }]
      })
    })
    return unsub
  }, [on])

  useEffect(() => {
    const unsub = on("chat_complete", () => {
      logger.info("Received chat_complete")
      setMessages((prev) =>
        streamingIdRef.current
          ? prev.map((m) => (m.id === streamingIdRef.current ? { ...m, streaming: false } : m))
          : prev,
      )
      streamingIdRef.current = null
    })
    return unsub
  }, [on])

  useEffect(() => {
    if (!sessionId) {
      clearMessages()
    }
  }, [sessionId, clearMessages])

  return { messages, addUserMessage, clearMessages }
}
