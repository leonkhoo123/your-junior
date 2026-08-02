import { useEffect, useRef } from "react"

export interface SlashCommand {
  name: string
  description: string
  aliases?: string[]
}

interface SlashCommandMenuProps {
  commands: SlashCommand[]
  query: string
  selectedIndex: number
  visible: boolean
  onSelect: (command: SlashCommand) => void
}

function highlight(str: string, query: string) {
  if (!query) return str
  const idx = str.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return str
  const before = str.slice(0, idx)
  const match = str.slice(idx, idx + query.length)
  const after = str.slice(idx + query.length)
  return (
    <>
      {before}
      <span className="text-primary font-semibold">{match}</span>
      {after}
    </>
  )
}

export function SlashCommandMenu({
  commands,
  query,
  selectedIndex,
  visible,
  onSelect,
}: SlashCommandMenuProps) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (visible && listRef.current) {
      const selected = listRef.current.children[selectedIndex] as HTMLElement | undefined
      selected?.scrollIntoView({ block: "nearest" })
    }
  }, [selectedIndex, visible])

  if (!visible || commands.length === 0) return null

  return (
    <div className="absolute bottom-full left-4 right-4 mb-1 z-50">
      <div
        ref={listRef}
        className="max-h-[240px] overflow-y-auto border border-primary/10 rounded-md bg-[#161b22] shadow-lg"
      >
        {commands.map((cmd, i) => (
          <button
            key={cmd.name}
            onClick={() => { onSelect(cmd) }}
            className={`w-full flex items-center gap-3 px-3 py-2 text-left font-mono text-xs transition-colors ${
              i === selectedIndex
                ? "bg-primary/15 text-primary"
                : "text-foreground/60 hover:bg-accent/25"
            }`}
          >
            <span className="shrink-0">
              /{highlight(cmd.name, query)}
            </span>
            <span className="truncate opacity-60">
              {cmd.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
