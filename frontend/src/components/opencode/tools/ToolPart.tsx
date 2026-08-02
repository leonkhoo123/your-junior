import type { ToolPartData } from "@/hooks/useChatMessages"
import { toolDisplay } from "./patterns"
import { ShellTool } from "./ShellTool"
import { WriteTool, EditTool, ReadTool, ApplyPatchTool } from "./FileTool"
import { GlobTool, GrepTool } from "./SearchTool"
import { WebFetchTool, WebSearchTool } from "./WebTool"
import { TaskTool } from "./TaskTool"
import { ExecuteTool, GenericTool, TodoWriteTool, QuestionTool, SkillTool } from "./OtherTools"

interface ToolPartProps {
  part: ToolPartData
  onSelectSession?: (sessionID: string, title: string) => void
}

export function ToolPart({ part, onSelectSession }: ToolPartProps) {
  const display = toolDisplay(part.tool)

  switch (display) {
    case "bash":
      return <ShellTool part={part} />
    case "write":
      return <WriteTool part={part} />
    case "edit":
      return <EditTool part={part} />
    case "read":
      return <ReadTool part={part} />
    case "apply_patch":
      return <ApplyPatchTool part={part} />
    case "glob":
      return <GlobTool part={part} />
    case "grep":
      return <GrepTool part={part} />
    case "webfetch":
      return <WebFetchTool part={part} />
    case "websearch":
      return <WebSearchTool part={part} />
    case "task":
      return <TaskTool part={part} onSelectSession={onSelectSession} />
    case "execute":
      return <ExecuteTool part={part} />
    case "todowrite":
      return <TodoWriteTool part={part} />
    case "question":
      return <QuestionTool part={part} />
    case "skill":
      return <SkillTool part={part} />
    default:
      return <GenericTool part={part} />
  }
}
