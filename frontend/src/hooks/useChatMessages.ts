import { useState, useRef, useEffect, useCallback } from "react"
import { logger } from "@/utils/logger"
import type { MessageHandler } from "@/hooks/useOpencodeWebSocket"

export interface ToolPartData {
  id: string
  tool: string
  callID: string
  status: "pending" | "running" | "completed" | "error"
  title?: string
  input?: Record<string, unknown>
  output?: string
  error?: string
  metadata?: Record<string, unknown>
  time?: { start: number; end?: number }
}

export interface DisplayMessage {
  id: string
  role: "user" | "assistant" | "tool"
  content: string
  reasoning: string
  streaming: boolean
  parts?: ToolPartData[]
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
        id: `user-${String(Date.now())}`,
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
      if (!sessionId) return
      const msgSessionId = typeof msg.data?.session_id === "string" ? msg.data.session_id : ""
      if (msgSessionId && msgSessionId !== sessionId) return

      const text = typeof msg.data?.text === "string" ? msg.data.text : ""
      const reasoning = typeof msg.data?.reasoning === "string" ? msg.data.reasoning : ""

      if (!text && !reasoning) return

      streamingIdRef.current ??= `msg-${String(Date.now())}`

      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === streamingIdRef.current)
        const sid = streamingIdRef.current
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
        return [...prev, { id: sid, role: "assistant", content: text, reasoning, streaming: true }]
      })
    })
    return unsub
  }, [on, sessionId])

  useEffect(() => {
    const unsub = on("part_updated", (msg) => {
      if (!sessionId) return
      const msgSessionId = typeof msg.data?.session_id === "string" ? msg.data.session_id : ""
      if (msgSessionId && msgSessionId !== sessionId) return

      const tool = typeof msg.data?.tool === "string" ? msg.data.tool : ""
      const status = typeof msg.data?.status === "string" ? msg.data.status : ""
      const partId = typeof msg.data?.part_id === "string" ? msg.data.part_id : ""
      const callID = typeof msg.data?.call_id === "string" ? msg.data.call_id : ""
      const title = typeof msg.data?.title === "string" ? msg.data.title : ""
      const input = msg.data?.input as Record<string, unknown> | undefined
      const output = typeof msg.data?.output === "string" ? msg.data.output : ""
      const error = typeof msg.data?.error === "string" ? msg.data.error : ""
      const metadata = msg.data?.metadata as Record<string, unknown> | undefined
      const time = msg.data?.time as { start: number; end?: number } | undefined

      if (!tool || !partId) return

      const toolPart: ToolPartData = {
        id: partId,
        tool,
        callID,
        status: status as ToolPartData["status"],
        title,
        input,
        output,
        error,
        metadata,
        time,
      }

      const mid = streamingIdRef.current

      setMessages((prev) => {
        const targetId = mid ?? `msg-${String(Date.now())}`
        const idx = prev.findIndex((m) => m.id === targetId)
        if (idx !== -1) {
          const updated = [...prev]
          const existingParts = updated[idx].parts ?? []
          const partIdx = existingParts.findIndex((p) => p.id === partId)
          if (partIdx !== -1) {
            const newParts = [...existingParts]
            newParts[partIdx] = toolPart
            updated[idx] = { ...updated[idx], parts: newParts }
          } else {
            updated[idx] = { ...updated[idx], parts: [...existingParts, toolPart] }
          }
          return updated
        }
        const newMsg: DisplayMessage = {
          id: targetId,
          role: "assistant",
          content: "",
          reasoning: "",
          streaming: true,
          parts: [toolPart],
        }
        return [...prev, newMsg]
      })

      if (!mid) {
        streamingIdRef.current = `msg-${String(Date.now())}`
      }

      logger.debug("tool part updated", { tool, status, partId })
    })
    return unsub
  }, [on, sessionId])

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
