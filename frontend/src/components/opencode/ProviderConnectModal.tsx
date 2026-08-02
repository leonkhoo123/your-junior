import { useState, useMemo } from "react"
import { Check, Plug } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ApiKeyDialog } from "@/components/opencode/ApiKeyDialog"
import { cn } from "@/lib/utils"
import { useArrowList } from "@/hooks/useArrowList"

interface AllProviderInfo {
  id: string
  name: string
}

interface ProviderConfig {
  id: string
  name: string
}

interface ProviderConnectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  providers: ProviderConfig[]
  allProviders: AllProviderInfo[]
  connectedProviderIDs: string[]
  onSetApiKey: (providerID: string, apiKey: string) => void
}

const PROVIDER_PRIORITY: Record<string, number> = {
  opencode: 0,
  "opencode-go": 1,
  openai: 2,
  "github-copilot": 3,
  anthropic: 4,
  google: 5,
}

const PROVIDER_DESCRIPTIONS: Record<string, string> = {
  opencode: "(Recommended)",
  anthropic: "(API key)",
  openai: "(ChatGPT Plus/Pro or API key)",
  "opencode-go": "Low cost subscription for everyone",
}

function getPriority(id: string): number {
  return PROVIDER_PRIORITY[id] ?? 99
}

interface ProviderEntry {
  id: string
  name: string
  connected: boolean
  description?: string
  category: "Popular" | "Providers"
}

export function ProviderConnectModal({
  open,
  onOpenChange,
  providers,
  allProviders,
  connectedProviderIDs,
  onSetApiKey,
}: ProviderConnectModalProps) {
  const [apiKeyProvider, setApiKeyProvider] = useState<{ id: string; name: string } | null>(null)

  const connectedSet = useMemo(() => new Set(connectedProviderIDs), [connectedProviderIDs])

  const { popular, rest } = useMemo(() => {
    const seen = new Set<string>()
    const pop: ProviderEntry[] = []
    const other: ProviderEntry[] = []

    for (const p of allProviders) {
      if (seen.has(p.id)) continue
      seen.add(p.id)
      const entry: ProviderEntry = {
        id: p.id,
        name: p.name,
        connected: connectedSet.has(p.id),
        description: PROVIDER_DESCRIPTIONS[p.id],
        category: p.id in PROVIDER_PRIORITY ? "Popular" : "Providers",
      }
      if (entry.category === "Popular") {
        pop.push(entry)
      } else {
        other.push(entry)
      }
    }

    for (const p of providers) {
      if (seen.has(p.id)) continue
      seen.add(p.id)
      const entry: ProviderEntry = {
        id: p.id,
        name: p.name,
        connected: connectedSet.has(p.id),
        description: PROVIDER_DESCRIPTIONS[p.id],
        category: p.id in PROVIDER_PRIORITY ? "Popular" : "Providers",
      }
      if (entry.category === "Popular") {
        pop.push(entry)
      } else {
        other.push(entry)
      }
    }

    const sortFn = (a: ProviderEntry, b: ProviderEntry) => {
      const pa = getPriority(a.id)
      const pb = getPriority(b.id)
      if (pa !== pb) return pa - pb
      return a.name.localeCompare(b.name)
    }

    return {
      popular: pop.sort(sortFn),
      rest: other.sort(sortFn),
    }
  }, [allProviders, providers, connectedSet])

  const handleSelectProvider = (provider: ProviderEntry) => {
    if (!provider.connected) {
      onOpenChange(false)
      setApiKeyProvider({ id: provider.id, name: provider.name })
    }
  }

  const handleApiKeyConfirm = (providerID: string, apiKey: string) => {
    onSetApiKey(providerID, apiKey)
    setApiKeyProvider(null)
  }

  const allRows = useMemo<ProviderEntry[]>(() => [...popular, ...rest], [popular, rest])

  const { containerRef, selectedIndex, setSelectedIndex, handleKeyDown } = useArrowList<ProviderEntry>({
    items: allRows,
    enabled: open,
    onSelect: handleSelectProvider,
  })

  const renderProviderRow = (provider: ProviderEntry, index: number) => (
    <button
      key={provider.id}
      data-list-item
      onMouseEnter={() => { setSelectedIndex(index) }}
      onClick={() => { handleSelectProvider(provider) }}
      className={cn(
        "w-full flex items-center gap-3 px-5 py-2 text-left font-mono text-sm transition-colors",
        provider.connected
          ? "text-muted-foreground/70 cursor-default"
          : "text-foreground hover:bg-accent/60 cursor-pointer",
        selectedIndex === index && "bg-accent/40"
      )}
    >
      <span className="flex-1 truncate">{provider.name}</span>
      {provider.description && (
        <span className="text-xs text-muted-foreground/60 shrink-0">
          {provider.description}
        </span>
      )}
      {provider.connected ? (
        <span className="text-green-400 shrink-0">
          <Check className="size-3.5" />
        </span>
      ) : (
        <span className="text-[10px] text-muted-foreground/50 shrink-0 font-medium">
          Setup
        </span>
      )}
    </button>
  )

  const hasAny = popular.length > 0 || rest.length > 0

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          onKeyDown={handleKeyDown}
          className="sm:max-w-[520px] p-0 gap-0 border-border bg-chat-bg"
        >
          <DialogHeader className="px-5 py-4 border-b border-primary/10">
            <DialogTitle className="text-base font-mono text-foreground">Connect a provider</DialogTitle>
          </DialogHeader>
          <div ref={containerRef} className="max-h-[60vh] overflow-y-auto">
            {hasAny ? (
              <div className="py-1">
                {popular.length > 0 && (
                  <>
                    <div className="px-5 pt-3 pb-1">
                      <span className="text-[11px] font-semibold text-amber-400/80 uppercase tracking-wider">
                        Popular
                      </span>
                    </div>
                    {popular.map((p, i) => renderProviderRow(p, i))}
                  </>
                )}

                {popular.length > 0 && rest.length > 0 && (
                  <div className="mx-5 my-2 border-t border-primary/10" />
                )}

                {rest.length > 0 && (
                  <>
                    <div className="px-5 pt-2 pb-1">
                      <span className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">
                        Providers
                      </span>
                    </div>
                    {rest.map((p, i) => renderProviderRow(p, popular.length + i))}
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                <Plug className="size-8 opacity-40" />
                <span className="font-mono text-sm">No providers available</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ApiKeyDialog
        open={apiKeyProvider !== null}
        onOpenChange={(val) => {
          if (!val) setApiKeyProvider(null)
        }}
        providerID={apiKeyProvider?.id ?? ""}
        providerName={apiKeyProvider?.name ?? ""}
        onConfirm={handleApiKeyConfirm}
      />
    </>
  )
}
