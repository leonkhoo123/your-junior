import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { MessageBubble } from "@/components/opencode/MessageBubble"
import { SlashCommandMenu } from "@/components/opencode/SlashCommandMenu"
import { useSlashCommands, filterCommands } from "@/components/opencode/useSlashCommands"
import type { SlashCommand } from "@/components/opencode/SlashCommandMenu"
import type { DisplayMessage } from "@/hooks/useChatMessages"

interface ChatPanelProps {
  sessionId: string | null
  messages: DisplayMessage[]
  onSendMessage: (text: string) => void
  onSlashCommand?: (command: string) => void
  thinkingExpanded?: boolean
  onSelectSession?: (sessionID: string, title: string) => void
}

export function ChatPanel({ sessionId, messages, onSendMessage, onSlashCommand, thinkingExpanded, onSelectSession }: ChatPanelProps) {
  const [input, setInput] = useState("")
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const allCommands = useSlashCommands()

  const slashActive = useMemo(() => input.startsWith("/") && !input.includes(" "), [input])
  const slashQuery = useMemo(() => (slashActive ? input.slice(1) : ""), [input, slashActive])
  const matchedCommands = useMemo(
    () => (onSlashCommand && slashActive ? filterCommands(allCommands, slashQuery) : []),
    [onSlashCommand, slashActive, allCommands, slashQuery],
  )

  const resetSlash = useCallback(() => {
    setSlashSelectedIndex(0)
  }, [])

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
    resetSlash()
    onSendMessage(text)
  }

  const handleSlashSelect = useCallback(
    (cmd: SlashCommand) => {
      setInput("")
      resetSlash()
      if (onSlashCommand) {
        onSlashCommand(cmd.name)
      }
    },
    [onSlashCommand, resetSlash],
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!sessionId) return

    if (slashActive && onSlashCommand && matchedCommands.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSlashSelectedIndex((prev) =>
          prev + 1 >= matchedCommands.length ? 0 : prev + 1,
        )
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setSlashSelectedIndex((prev) =>
          prev - 1 < 0 ? matchedCommands.length - 1 : prev - 1,
        )
        return
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        const idx = Math.min(slashSelectedIndex, matchedCommands.length - 1)
        handleSlashSelect(matchedCommands[idx])
        return
      }
      if (e.key === "Tab") {
        e.preventDefault()
        const idx = Math.min(slashSelectedIndex, matchedCommands.length - 1)
        handleSlashSelect(matchedCommands[idx])
        return
      }
      if (e.key === "Escape") {
        e.preventDefault()
        setInput("")
        resetSlash()
        return
      }
      return
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!sessionId) return
    const val = e.target.value
    setInput(val)
    if (val.startsWith("/") && !val.includes(" ")) {
      setSlashSelectedIndex(0)
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[#0d1117]">
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="font-mono text-sm text-muted-foreground/40">
              {sessionId
                ? 'Type a message and press Enter to begin. Try /new, /model, /thinking...'
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
            thinkingExpanded={thinkingExpanded}
            onSelectSession={onSelectSession}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-primary/10 px-4 py-3 relative">
        <SlashCommandMenu
          commands={matchedCommands}
          query={slashQuery}
          selectedIndex={Math.min(slashSelectedIndex, Math.max(0, matchedCommands.length - 1))}
          visible={slashActive && onSlashCommand !== undefined && matchedCommands.length > 0}
          onSelect={handleSlashSelect}
        />
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-primary/40 shrink-0">{">"}</span>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent font-mono text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none"
            placeholder={sessionId ? "ask opencode..." : "start the server first..."}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={!sessionId}
          />
        </div>
      </div>
    </div>
  )
}
