import { ChevronDown } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface ModelInfo {
  id: string
  name: string
  provider_id: string
  variants?: Record<string, unknown>
}

interface VariantSelectorProps {
  providerID: string
  modelID: string
  providers: { id: string; name: string; models: Record<string, ModelInfo> }[]
  currentVariant?: string
  onVariantChange: (providerID: string, modelID: string, variant?: string) => void
  disabled?: boolean
}

export function VariantSelector({
  providerID,
  modelID,
  providers,
  currentVariant,
  onVariantChange,
  disabled,
}: VariantSelectorProps) {
  const provider = providers.find((p) => p.id === providerID)
  const model = provider?.models[modelID]
  const variants = model?.variants ? Object.keys(model.variants) : []

  if (variants.length === 0) return null

  const selectedValue = currentVariant ?? "default"

  return (
    <Select
      disabled={disabled}
      value={selectedValue}
      onValueChange={(value) => {
        onVariantChange(providerID, modelID, value === "default" ? undefined : value)
      }}
    >
      <SelectTrigger
        size="sm"
        className="h-6 px-2 text-xs font-mono border-0 border-l border-primary/10 rounded-none bg-transparent hover:bg-accent/50 gap-1.5 [&_svg]:size-3"
      >
        <SelectValue placeholder="Default" />
        <ChevronDown className="size-3 opacity-50" />
      </SelectTrigger>
      <SelectContent align="end" className="w-[200px]">
        <SelectGroup>
          <SelectItem value="default" className="font-mono text-xs">
            Default
          </SelectItem>
          {variants.map((variant) => (
            <SelectItem key={variant} value={variant} className="font-mono text-xs">
              {variant}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
