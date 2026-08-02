import { useMemo } from "react"
import type { SlashCommand } from "@/components/opencode/SlashCommandMenu"

export function useSlashCommands(): SlashCommand[] {
  return useMemo(
    () => [
      { name: "new", description: "Start a new chat", aliases: ["clear"] },
      { name: "thinking", description: "Toggle auto-expand thinking" },
      { name: "variants", description: "Show model variants" },
      { name: "model", description: "Switch AI model", aliases: ["mo"] },
      { name: "session", description: "Browse past sessions" },
      { name: "connect", description: "Connect a provider" },
    ],
    [],
  )
}

export function filterCommands(
  commands: SlashCommand[],
  query: string,
): SlashCommand[] {
  const q = query.toLowerCase()
  return commands.filter(
    (cmd) =>
      cmd.name.toLowerCase().startsWith(q) ||
      cmd.aliases?.some((a) => a.toLowerCase().startsWith(q)),
  )
}
