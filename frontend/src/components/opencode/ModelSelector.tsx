import { ChevronDown } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface ModelInfo {
  id: string
  name: string
  provider_id: string
  cost?: { input: number; output: number }
  variants?: Record<string, unknown>
  release_date?: string
  status?: string
}

interface ProviderConfig {
  id: string
  name: string
  models: Record<string, ModelInfo>
}

interface ModelSelectorProps {
  providers: ProviderConfig[]
  currentModel: string
  onModelChange: (providerID: string, modelID: string, variant?: string) => void
  disabled?: boolean
}

function parseModel(raw: string): { providerID: string; modelID: string; variant?: string } {
  const atIndex = raw.lastIndexOf("@")
  let modelPart = raw
  let variant: string | undefined
  if (atIndex > 0) {
    modelPart = raw.slice(0, atIndex)
    variant = raw.slice(atIndex + 1)
  }
  const [providerID, ...rest] = modelPart.split("/")
  return { providerID, modelID: rest.join("/"), variant }
}

const PROVIDER_PRIORITY: Record<string, number> = {
  opencode: 0,
  "opencode-go": 1,
  openai: 2,
  "github-copilot": 3,
  anthropic: 4,
  google: 5,
}

export function ModelSelector({
  providers,
  currentModel,
  onModelChange,
  disabled,
}: ModelSelectorProps) {
  if (providers.length === 0) {
    return (
      <span className="font-mono text-xs text-muted-foreground/50">{currentModel}</span>
    )
  }

  const sortedProviders = [...providers].sort((a, b) => {
    const pa = PROVIDER_PRIORITY[a.id] ?? 99
    const pb = PROVIDER_PRIORITY[b.id] ?? 99
    if (pa !== pb) return pa - pb
    return a.name.localeCompare(b.name)
  })

  const { providerID: currentProvider, modelID: currentModelID } = parseModel(currentModel)

  return (
    <Select
      disabled={disabled}
      value={`${currentProvider}/${currentModelID}`}
      onValueChange={(value) => {
        const [providerID, ...rest] = value.split("/")
        const modelID = rest.join("/")
        onModelChange(providerID, modelID)
      }}
    >
      <SelectTrigger
        size="sm"
        className="h-6 px-2 text-xs font-mono border-0 bg-transparent hover:bg-accent/50 gap-1.5 [&_svg]:size-3"
      >
        <SelectValue placeholder="Select model" />
        <ChevronDown className="size-3 opacity-50" />
      </SelectTrigger>
      <SelectContent align="end" className="w-[400px]">
        {sortedProviders.map((provider) => (
          <SelectGroup key={provider.id}>
            <SelectLabel className="font-mono text-xs">
              {provider.name}
            </SelectLabel>
            {Object.entries(provider.models)
              .filter(([, info]) => info.status !== "deprecated")
              .sort(([, a], [, b]) => {
                const dateA = a.release_date ?? ""
                const dateB = b.release_date ?? ""
                return dateB.localeCompare(dateA)
              })
              .map(([modelID, info]) => {
                const isFree = info.cost?.input === 0 && provider.id === "opencode"
                return (
                  <SelectItem
                    key={`${provider.id}/${modelID}`}
                    value={`${provider.id}/${modelID}`}
                    className="font-mono text-xs"
                  >
                    <div className="flex items-center gap-2 w-full">
                      <span className="truncate flex-1">{info.name || modelID}</span>
                      {isFree && (
                        <span className="text-[10px] text-green-400 shrink-0">Free</span>
                      )}
                      {info.variants && Object.keys(info.variants).length > 0 && (
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {Object.keys(info.variants).length} variants
                        </span>
                      )}
                    </div>
                  </SelectItem>
                )
              })}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}
