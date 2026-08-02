import { useState, useRef } from "react"
import { KeyRound, Eye, EyeOff, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface ApiKeyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  providerID: string
  providerName: string
  onConfirm: (providerID: string, apiKey: string) => void
}

export function ApiKeyDialog({
  open,
  onOpenChange,
  providerID,
  providerName,
  onConfirm,
}: ApiKeyDialogProps) {
  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = () => {
    if (!apiKey.trim() || submitting) return
    setSubmitting(true)
    onConfirm(providerID, apiKey.trim())
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-5" />
            Connect to {providerName}
          </DialogTitle>
          <DialogDescription>
            Enter your {providerName} API key to connect this provider.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="relative">
            <Input
              ref={inputRef}
              type={showKey ? "text" : "password"}
              placeholder="Enter API key"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value)
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit()
              }}
              disabled={submitting}
              autoFocus
              className="pr-10 font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => {
                setShowKey(!showKey)
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { onOpenChange(false) }} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!apiKey.trim() || submitting}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
