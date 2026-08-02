import type { ToolPartData } from "@/hooks/useChatMessages"

export function collapseToolOutput(output: string, maxLines: number, maxChars: number) {
  const lines = output.split("\n")
  if (lines.length <= maxLines && Array.from(output).length <= maxChars) {
    return { output, overflow: false }
  }
  const preview = lines.slice(0, maxLines).join("\n")
  if (Array.from(preview).length > maxChars) {
    return {
      output:
        Array.from(preview)
          .slice(0, Math.max(0, maxChars - 1))
          .join("") + "\u2026",
      overflow: true,
    }
  }
  return {
    output: [...lines.slice(0, maxLines), "\u2026"].join("\n"),
    overflow: true,
  }
}

const TOOL_DISPLAY_SET = new Set([
  "bash", "glob", "read", "grep", "webfetch", "websearch",
  "write", "edit", "task", "apply_patch", "todowrite",
  "question", "skill", "execute",
])

export function toolDisplay(tool: string): string {
  return TOOL_DISPLAY_SET.has(tool) ? tool : "generic"
}

export function toolIcon(tool: string): string {
  switch (tool) {
    case "bash": return "$"
    case "write": return "\u2190"
    case "edit": return "\u2190"
    case "apply_patch": return "\u2190"
    case "read": return "\u2192"
    case "glob": return "\u2731"
    case "grep": return "\u2731"
    case "webfetch": return "%"
    case "websearch": return "\u25c8"
    case "task": return "\u2502"
    case "execute": return "\u2502"
    case "todowrite": return "\u2610"
    case "question": return "?"
    case "skill": return "\u25c6"
    default: return "\u2699"
  }
}

export function toolPending(tool: string): string {
  switch (tool) {
    case "bash": return "Writing command..."
    case "write": return "Preparing write..."
    case "edit": return "Preparing edit..."
    case "read": return "Reading file..."
    case "glob": return "Finding files..."
    case "grep": return "Searching content..."
    case "webfetch": return "Fetching from the web..."
    case "websearch": return "Searching web..."
    case "task": return "Delegating..."
    case "apply_patch": return "Applying patch..."
    case "todowrite": return "Writing todos..."
    case "question": return "Asking question..."
    case "skill": return "Loading skill..."
    case "execute": return "execute"
    default: return "Writing command..."
  }
}

export function statusIcon(status: ToolPartData["status"]): string {
  switch (status) {
    case "pending": return "\u25cb"
    case "running": return "\u25cc"
    case "completed": return "\u2713"
    case "error": return "\u2717"
    default: return ""
  }
}

export function statusColor(status: ToolPartData["status"]): string {
  switch (status) {
    case "pending": return "text-muted-foreground/40"
    case "running": return "text-amber-400"
    case "completed": return "text-green-500"
    case "error": return "text-red-400"
    default: return ""
  }
}

export function statusBorder(status: ToolPartData["status"]): string {
  switch (status) {
    case "running": return "border-amber-500/20"
    case "completed": return "border-green-500/15"
    case "error": return "border-red-500/20"
    default: return "border-muted-foreground/10"
  }
}

export function statusBg(status: ToolPartData["status"]): string {
  switch (status) {
    case "running": return "bg-amber-500/5"
    case "completed": return "bg-green-500/5"
    case "error": return "bg-red-500/5"
    default: return "bg-muted/20"
  }
}

export function strVal(val: unknown): string | undefined {
  return typeof val === "string" ? val : undefined
}

export function numVal(val: unknown): number | undefined {
  return typeof val === "number" ? val : undefined
}

export function inputArgs(input: Record<string, unknown>, exclude: string[] = []): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(input)) {
    if (exclude.includes(key)) continue
    if (typeof value === "boolean" && value) parts.push(key)
    else if (typeof value === "string") parts.push(`${key}=${value}`)
    else if (typeof value === "number") parts.push(`${key}=${value}`)
  }
  return parts.join(", ")
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}m ${secs}s`
}

const EXT_TO_LANG: Record<string, string> = {
  ".c": "c", ".cpp": "cpp", ".cxx": "cpp", ".cc": "cpp",
  ".cs": "csharp", ".css": "css", ".dart": "dart",
  ".go": "go", ".java": "java",
  ".js": "javascript", ".jsx": "javascript", ".mjs": "javascript", ".cjs": "javascript",
  ".ts": "typescript", ".tsx": "typescript", ".mts": "typescript", ".cts": "typescript",
  ".json": "json", ".yaml": "yaml", ".yml": "yaml", ".md": "markdown",
  ".py": "python", ".rs": "rust", ".rb": "ruby", ".swift": "swift",
  ".kt": "kotlin", ".kts": "kotlin", ".scala": "scala", ".lua": "lua",
  ".sql": "sql", ".html": "html", ".xml": "xml", ".svg": "xml",
  ".sh": "bash", ".bash": "bash", ".zsh": "shell",
  ".hs": "haskell", ".ml": "ocaml", ".mli": "ocaml",
  ".php": "php", ".ex": "elixir", ".exs": "elixir",
  ".erl": "erlang", ".hrl": "erlang",
  ".jl": "julia", ".r": "r",
  ".nix": "nix", ".diff": "diff", ".patch": "diff",
  ".fs": "fsharp", ".fsi": "fsharp", ".fsx": "fsharp",
  ".clj": "clojure", ".cljs": "clojure", ".cljc": "clojure",
  ".tf": "bash", ".hcl": "bash", ".toml": "bash",
}

export function filetype(filePath: string | undefined): string {
  if (!filePath) return "plaintext"
  const dot = filePath.lastIndexOf(".")
  if (dot === -1) return "plaintext"
  const ext = filePath.slice(dot).toLowerCase()
  return EXT_TO_LANG[ext] ?? "plaintext"
}
