import { useState, useMemo, useEffect } from "react"
import { Check, Plug, KeyRound, ArrowLeft } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ApiKeyDialog } from "@/components/opencode/ApiKeyDialog"
import { cn } from "@/lib/utils"
import { useArrowList } from "@/hooks/useArrowList"

export interface VariantTarget {
  providerID: string
  modelID: string
  modelName: string
  variants: Record<string, unknown>
}

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

interface AllProviderInfo {
  id: string
  name: string
  models?: Record<string, ModelInfo>
}

interface ModelSelectorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  providers: ProviderConfig[]
  allProviders: AllProviderInfo[]
  connectedProviderIDs: string[]
  currentModel: string
  onModelChange: (providerID: string, modelID: string, variant?: string) => void
  onSetApiKey: (providerID: string, apiKey: string) => void
  initialVariant?: VariantTarget | null
}

const PROVIDER_PRIORITY: Record<string, number> = {
  opencode: 0,
  "opencode-go": 1,
  openai: 2,
  "github-copilot": 3,
  anthropic: 4,
  google: 5,
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

function getPriority(id: string): number {
  return PROVIDER_PRIORITY[id] ?? 99
}

export function ModelSelectorModal({
  open,
  onOpenChange,
  providers,
  allProviders,
  connectedProviderIDs,
  currentModel,
  onModelChange,
  onSetApiKey,
  initialVariant = null,
}: ModelSelectorModalProps) {
  const [apiKeyProvider, setApiKeyProvider] = useState<{ id: string; name: string } | null>(null)
  const [variantModel, setVariantModel] = useState<VariantTarget | null>(null)

  useEffect(() => {
    if (open) setVariantModel(initialVariant ?? null)
  }, [open, initialVariant])

  const handleOpenChange = (open: boolean) => {
    if (!open) setVariantModel(null)
    onOpenChange(open)
  }

  const connectedSet = useMemo(() => new Set(connectedProviderIDs), [connectedProviderIDs])

  const { connected, notConnected } = useMemo(() => {
    const conn: ProviderConfig[] = []
    const notConn: AllProviderInfo[] = []
    const connIDs = new Set<string>()

    for (const p of providers) {
      if (connectedSet.has(p.id)) {
        conn.push(p)
        connIDs.add(p.id)
      }
    }

    const sortedConn = [...conn].sort((a, b) => {
      const pa = getPriority(a.id)
      const pb = getPriority(b.id)
      if (pa !== pb) return pa - pb
      return a.name.localeCompare(b.name)
    })

    const seen = new Set<string>()
    for (const p of allProviders) {
      if (connectedSet.has(p.id) || connIDs.has(p.id)) continue
      if (seen.has(p.id)) continue
      seen.add(p.id)
      notConn.push(p)
    }

    const sortedNotConn = [...notConn].sort((a, b) => {
      const pa = getPriority(a.id)
      const pb = getPriority(b.id)
      if (pa !== pb) return pa - pb
      return a.name.localeCompare(b.name)
    })

    return { connected: sortedConn, notConnected: sortedNotConn }
  }, [providers, allProviders, connectedSet])

  const { providerID: currentProvider, modelID: currentModelID, variant: currentVariant } = parseModel(currentModel)

  const handleModelClick = (providerID: string, modelID: string, info: ModelInfo) => {
    if (info.variants && Object.keys(info.variants).length > 0) {
      setVariantModel({
        providerID,
        modelID,
        modelName: info.name || modelID,
        variants: info.variants,
      })
    } else {
      onModelChange(providerID, modelID)
      onOpenChange(false)
    }
  }

  const handleVariantSelect = (variant?: string) => {
    if (!variantModel) return
    onModelChange(variantModel.providerID, variantModel.modelID, variant)
    onOpenChange(false)
  }

  const handleBack = () => {
    setVariantModel(null)
  }

  const isCurrentVariant = (name: string) => {
    if (!variantModel) return false
    if (currentProvider !== variantModel.providerID || currentModelID !== variantModel.modelID) return false
    if (name === "default") return !currentVariant
    return currentVariant === name
  }

  const handleConnectProvider = (providerID: string) => {
    const provider = allProviders.find((p) => p.id === providerID)
      ?? providers.find((p) => p.id === providerID)
    if (provider) {
      setApiKeyProvider({ id: providerID, name: provider.name })
    }
  }

  const handleApiKeyConfirm = (providerID: string, apiKey: string) => {
    onSetApiKey(providerID, apiKey)
    setApiKeyProvider(null)
  }

  type MainListItem =
    | { kind: "model"; providerID: string; modelID: string; info: ModelInfo }
    | { kind: "connect"; providerID: string; name: string }

  const listItems = useMemo<MainListItem[]>(() => {
    const out: MainListItem[] = []
    for (const provider of connected) {
      const models = Object.entries(provider.models)
        .filter(([, info]) => info.status !== "deprecated")
        .sort(([, a], [, b]) => (b.release_date ?? "").localeCompare(a.release_date ?? ""))
      for (const [modelID, info] of models) {
        out.push({ kind: "model", providerID: provider.id, modelID, info })
      }
    }
    for (const p of notConnected) {
      out.push({ kind: "connect", providerID: p.id, name: p.name })
    }
    return out
  }, [connected, notConnected])

  const variantItems = useMemo<string[]>(
    () => (variantModel ? ["default", ...Object.keys(variantModel.variants)] : []),
    [variantModel],
  )

  const mainNav = useArrowList<MainListItem>({
    items: listItems,
    enabled: open && variantModel === null,
    onSelect: (item) => {
      if (item.kind === "model") {
        handleModelClick(item.providerID, item.modelID, item.info)
      } else {
        handleConnectProvider(item.providerID)
      }
    },
  })

  const variantNav = useArrowList<string>({
    items: variantItems,
    enabled: open && variantModel !== null,
    onSelect: (name) => {
      handleVariantSelect(name === "default" ? undefined : name)
    },
  })

  const renderVariantList = () => {
    if (!variantModel) return null
    let itemIndex = 0
    return (
      <>
        <DialogHeader className="px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            {initialVariant === null && (
              <button
                onClick={handleBack}
                className="flex items-center justify-center size-7 rounded-md hover:bg-accent/60 transition-colors -ml-1"
                aria-label="Back to model list"
              >
                <ArrowLeft className="size-4" />
              </button>
            )}
            <DialogTitle className="text-base font-mono">{variantModel.modelName}</DialogTitle>
          </div>
        </DialogHeader>
        <div ref={variantNav.containerRef} className="max-h-[60vh] overflow-y-auto">
          <div className="px-2 pt-2 pb-3">
            <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Select Variant
            </div>
            <button
              data-list-item
              onMouseEnter={() => { variantNav.setSelectedIndex(0) }}
              onClick={() => {
                handleVariantSelect(undefined)
              }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 text-left font-mono text-sm rounded-md mx-1 transition-colors",
                "hover:bg-accent/60",
                isCurrentVariant("default") && "bg-accent/40",
                variantNav.selectedIndex === 0 && "bg-accent/40 ring-1 ring-inset ring-primary/50"
              )}
            >
              {isCurrentVariant("default") ? (
                <Check className="size-3.5 text-primary shrink-0" />
              ) : (
                <span className="size-3.5 shrink-0" />
              )}
              <span className="truncate flex-1">Default</span>
            </button>
            {Object.keys(variantModel.variants).map((variant) => {
              itemIndex += 1
              const i = itemIndex
              return (
                <button
                  key={variant}
                  data-list-item
                  onMouseEnter={() => { variantNav.setSelectedIndex(i) }}
                  onClick={() => {
                    handleVariantSelect(variant)
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 text-left font-mono text-sm rounded-md mx-1 transition-colors",
                    "hover:bg-accent/60",
                    isCurrentVariant(variant) && "bg-accent/40",
                    variantNav.selectedIndex === i && "bg-accent/40 ring-1 ring-inset ring-primary/50"
                  )}
                >
                  {isCurrentVariant(variant) ? (
                    <Check className="size-3.5 text-primary shrink-0" />
                  ) : (
                    <span className="size-3.5 shrink-0" />
                  )}
                  <span className="truncate flex-1">{variant}</span>
                </button>
              )
            })}
          </div>
        </div>
      </>
    )
  }

  const renderMainList = () => {
    let itemIndex = -1
    return (
      <>
        <DialogHeader className="px-5 py-4 border-b">
          <DialogTitle className="text-base font-mono">Select Model</DialogTitle>
        </DialogHeader>
        <div ref={mainNav.containerRef} className="max-h-[60vh] overflow-y-auto">
          {connected.length > 0 && (
            <div className="px-2 pt-2">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Connected
              </div>
              {connected.map((provider) => (
                <div key={provider.id}>
                  <div className="px-3 py-1 text-[11px] font-mono text-muted-foreground/60">
                    {provider.name}
                  </div>
                  {Object.entries(provider.models)
                    .filter(([, info]) => info.status !== "deprecated")
                    .sort(([, a], [, b]) => {
                      const dateA = a.release_date ?? ""
                      const dateB = b.release_date ?? ""
                      return dateB.localeCompare(dateA)
                    })
                    .map(([modelID, info]) => {
                      itemIndex += 1
                      const i = itemIndex
                      const isCurrent =
                        currentProvider === provider.id && currentModelID === modelID
                      const isFree = info.cost?.input === 0 && provider.id === "opencode"
                      const variantCount =
                        info.variants ? Object.keys(info.variants).length : 0
                      return (
                        <button
                          key={`${provider.id}/${modelID}`}
                          data-list-item
                          onMouseEnter={() => { mainNav.setSelectedIndex(i) }}
                          onClick={() => {
                            handleModelClick(provider.id, modelID, info)
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 text-left font-mono text-sm rounded-md mx-1 transition-colors",
                            "hover:bg-accent/60",
                            isCurrent && "bg-accent/40",
                            mainNav.selectedIndex === i && "bg-accent/40 ring-1 ring-inset ring-primary/50"
                          )}
                        >
                          {isCurrent ? (
                            <Check className="size-3.5 text-primary shrink-0" />
                          ) : (
                            <span className="size-3.5 shrink-0" />
                          )}
                          <span className="truncate flex-1">{info.name || modelID}</span>
                          {isFree && (
                            <span className="text-[10px] text-green-400 shrink-0 font-medium">
                              Free
                            </span>
                          )}
                          {variantCount > 0 && (
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {variantCount} variants
                            </span>
                          )}
                        </button>
                      )
                    })}
                </div>
              ))}
            </div>
          )}

          {notConnected.length > 0 && (
            <div className="px-2 pt-2 pb-3">
              {connected.length > 0 && (
                <div className="mx-3 my-2 border-t border-border" />
              )}
              <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Connect Provider
              </div>
              {notConnected.map((provider) => {
                itemIndex += 1
                const i = itemIndex
                return (
                  <div key={provider.id}>
                    <button
                      data-list-item
                      onMouseEnter={() => { mainNav.setSelectedIndex(i) }}
                      onClick={() => {
                        handleConnectProvider(provider.id)
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 text-left font-mono text-sm rounded-md mx-1 transition-colors",
                        "hover:bg-accent/60 text-muted-foreground",
                        mainNav.selectedIndex === i && "bg-accent/40 ring-1 ring-inset ring-primary/50"
                      )}
                    >
                      <span className="flex-1">{provider.name}</span>
                      <KeyRound className="size-3.5 shrink-0" />
                      <span className="text-[10px] text-muted-foreground/60">
                        Setup API key
                      </span>
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {providers.length === 0 && allProviders.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Plug className="size-8 opacity-40" />
              <span className="font-mono text-sm">No providers available</span>
            </div>
          )}
        </div>
      </>
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          onKeyDown={(e) => {
            variantNav.handleKeyDown(e)
            mainNav.handleKeyDown(e)
          }}
          className="sm:max-w-[520px] p-0 gap-0"
        >
          {variantModel ? renderVariantList() : renderMainList()}
        </DialogContent>
      </Dialog>

      <ApiKeyDialog
        open={apiKeyProvider !== null}
        onOpenChange={(open) => {
          if (!open) setApiKeyProvider(null)
        }}
        providerID={apiKeyProvider?.id ?? ""}
        providerName={apiKeyProvider?.name ?? ""}
        onConfirm={handleApiKeyConfirm}
      />
    </>
  )
}
