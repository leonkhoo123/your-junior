import { logger } from "@/utils/logger"

export type WSStatus = "disconnected" | "connecting" | "connected"

interface WSMessage {
  type: string
  data?: Record<string, unknown>
}

type MessageHandler = (msg: WSMessage) => void
type StatusHandler = (status: WSStatus) => void

function getWsUrl(): string {
  const url = import.meta.env.DEV
    ? `ws://${window.location.hostname}:3333/api/opencode/ws`
    : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/api/opencode/ws`
  logger.debug("WebSocket URL resolved", { url })
  return url
}

class WebSocketClient {
  private socket: WebSocket | null = null
  private listeners = new Set<MessageHandler>()
  private statusListeners = new Set<StatusHandler>()
  private reconnectTimer: number | null = null
  private pingTimer: number | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 15
  private _status: WSStatus = "disconnected"
  private intentionalClose = false

  get status(): WSStatus {
    return this._status
  }

  private setStatus(s: WSStatus) {
    const prev = this._status
    this._status = s
    if (prev !== s) {
      logger.info(`WebSocket status: ${prev} -> ${s}`)
    }
    this.statusListeners.forEach((fn) => { fn(s) })
  }

  connect() {
    if (this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) {
      logger.debug("WebSocket already connected or connecting, skipping connect()")
      return
    }

    this.intentionalClose = false
    this.setStatus("connecting")
    logger.info("WebSocket connecting", { url: getWsUrl() })

    const ws = new WebSocket(getWsUrl())

    ws.onopen = () => {
      if (this.intentionalClose) return
      this.reconnectAttempts = 0
      logger.info("WebSocket connected")
      this.setStatus("connected")
      this.startPing()
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as WSMessage
        logger.debug("WS received", { type: msg.type, dataKeys: msg.data ? Object.keys(msg.data) : [] })
        this.listeners.forEach((fn) => { fn(msg) })
      } catch {
        logger.warn("WS failed to parse message", { raw: String(event.data).slice(0, 200) })
      }
    }

    ws.onclose = (event) => {
      this.stopPing()
      this.socket = null
      logger.info("WebSocket closed", { code: event.code, reason: event.reason, wasClean: event.wasClean })
      this.setStatus("disconnected")
      if (this.intentionalClose) return
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++
        const delay = Math.min(2000 * Math.pow(1.5, this.reconnectAttempts), 15000)
        logger.info(`WebSocket reconnecting in ${String(delay)}ms`, { attempt: this.reconnectAttempts, maxAttempts: this.maxReconnectAttempts })
        this.reconnectTimer = window.setTimeout(() => { this.connect() }, delay)
      } else {
        logger.error("WebSocket max reconnect attempts reached")
      }
    }

    ws.onerror = () => {
      logger.warn("WebSocket error event fired")
    }

    this.socket = ws
  }

  disconnect() {
    logger.info("WebSocket intentional disconnect")
    this.intentionalClose = true
    this.reconnectAttempts = this.maxReconnectAttempts
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.stopPing()
    if (this.socket && this.socket.readyState !== WebSocket.CONNECTING) {
      this.socket.close()
    }
    this.socket = null
    this.setStatus("disconnected")
  }

  send(msg: WSMessage) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      logger.debug("WS sending", { type: msg.type, dataKeys: msg.data ? Object.keys(msg.data) : [] })
      this.socket.send(JSON.stringify(msg))
    } else {
      logger.warn("WS send skipped (not connected)", { type: msg.type, readyState: this.socket?.readyState })
    }
  }

  subscribe(handler: MessageHandler) {
    this.listeners.add(handler)
    logger.debug("WS listener subscribed", { listenerCount: this.listeners.size })
    return () => {
      this.listeners.delete(handler)
      logger.debug("WS listener unsubscribed", { listenerCount: this.listeners.size })
    }
  }

  subscribeStatus(handler: StatusHandler) {
    this.statusListeners.add(handler)
    handler(this._status)
    return () => { this.statusListeners.delete(handler) }
  }

  private startPing() {
    this.stopPing()
    this.pingTimer = window.setInterval(() => {
      logger.debug("WS sending ping")
      this.send({ type: "ping", data: {} })
    }, 30000)
  }

  private stopPing() {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }
}

export const wsClient = new WebSocketClient()
