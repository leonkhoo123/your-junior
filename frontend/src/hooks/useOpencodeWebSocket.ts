import { useEffect, useState, useCallback } from "react"
import { wsClient } from "@/api/wsClient"
import type { WSStatus } from "@/api/wsClient"

type WSMessage = {
  type: string
  data?: Record<string, unknown>
}

type MessageHandler = (msg: WSMessage) => void

export type { WSStatus, WSMessage, MessageHandler }

export function useOpencodeWebSocket() {
  const [status, setStatus] = useState<WSStatus>(wsClient.status)

  useEffect(() => {
    const unsub = wsClient.subscribeStatus(setStatus)
    return unsub
  }, [])

  const send = useCallback((msg: WSMessage) => {
    wsClient.send(msg)
  }, [])

  const on = useCallback((type: string, handler: MessageHandler) => {
    return wsClient.subscribe((msg) => {
      if (msg.type === type) {
        handler(msg)
      }
    })
  }, [])

  return { status, send, on }
}
