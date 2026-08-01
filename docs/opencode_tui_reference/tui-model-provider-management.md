# OpenCode TUI: Model & Provider Management Reference

> **Source**: `/home/leon/Documents/others_git/opencode-dev/packages/tui/src/`
> **Framework**: OpenTUI + SolidJS (terminal UI)
> **Date**: 2026-08-01

This document is a technical reference outlining how the OpenCode TUI (Terminal User Interface) implements **model selection**, **model variant selection**, and **provider API key management**. It is intended as a design reference for implementing similar UIs in other frontends (e.g., Go+Gin web app, SPA).

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                      TUI Frontend (SolidJS)                  │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Dialog Model │  │ Dialog       │  │ Dialog Provider   │  │
│  │ (select)     │  │ Variant      │  │ (API key / OAuth) │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬──────────┘  │
│         │                 │                    │              │
│  ┌──────┴─────────────────┴────────────────────┴──────────┐  │
│  │              Local State (SolidJS Store)                │  │
│  │  model / recent / favorite / variant                   │  │
│  │  └── persisted to <state_dir>/model.json               │  │
│  └────────────────────────┬───────────────────────────────┘  │
│                           │                                  │
│  ┌────────────────────────┴───────────────────────────────┐  │
│  │              Sync Context (Server Data)                 │  │
│  │  Providers / Agents / Config / Auth Methods            │  │
│  └────────────────────────┬───────────────────────────────┘  │
│                           │                                  │
│                    ┌──────┴──────┐                           │
│                    │  SDK Client │ (HTTP + SSE)              │
│                    └──────┬──────┘                           │
└───────────────────────────┼──────────────────────────────────┘
                            │
                    ┌───────┴───────┐
                    │ OpenCode      │
                    │ Server        │
                    │ (Go backend)  │
                    └───────────────┘
```

### Key Components

| Component | File | Role |
|-----------|------|------|
| `DialogModel` | `component/dialog-model.tsx` | Model selection dialog |
| `DialogVariant` | `component/dialog-variant.tsx` | Variant selection dialog |
| `DialogProvider` | `component/dialog-provider.tsx` | Provider connection / API key entry |
| `DialogSelect<T>` | `ui/dialog-select.tsx` | Generic filterable select list with keyboard/mouse nav |
| `DialogPrompt` | `ui/dialog-prompt.tsx` | Single-line text input dialog (for API keys, OAuth codes) |
| `Dialog` | `ui/dialog.tsx` | Modal backdrop + stack-based dialog manager |
| `local.tsx` | `context/local.tsx` | Local state store (model favorites, recents, variants, sessions) |
| `sync.tsx` | `context/sync.tsx` | Server data store (providers, agents, config, auth methods) |
| `persistence.ts` | `util/persistence.ts` | Atomic JSON file read/write |

---

## 2. Model Selection

### 2.1 Triggering

Models are selected via the `DialogModel` component, triggered through:

1. **Keybinding** `<leader>m` (defined in `config/keybind.ts:121`)
2. **Command palette** slash commands: `/models` or `/mo`
3. **Auto-triggered** after provider connection is completed
4. **Auto-triggered** when no providers are connected (first-run flow)

```typescript
// app.tsx:630 — model.list command
{
  name: "model.list",
  title: "Switch model",
  slashName: "models",
  slashAliases: ["mo"],
  run: () => {
    dialog.replace(() => <DialogModel />)
  },
}
```

### 2.2 Option List Construction (`dialog-model.tsx:23-130`)

Options are built by merging multiple data sources with a clear priority:

```
┌───────────────────────────────────────────────────────┐
│  When connected AND not filtered AND not scoped:      │
│  1. Favorites (from model.json)                       │
│  2. Recent (from model.json, excluding favorites)     │
│  3. All models grouped by provider                    │
│     - "opencode" provider listed first                │
│     - Free models (cost.input === 0) listed first     │
│     - Deprecated models filtered out                  │
│     - Nested variants? Deduplicated                   │
│                                                       │
│  When NOT connected:                                  │
│  1. "Popular providers" (first 6 from all providers)  │
│                                                       │
│  When filtering (needle key present):                 │
│  - Fuzzy search across all options (fuzzysort)        │
│  - Prioritized by title match (2x) + category (1x)    │
└───────────────────────────────────────────────────────┘
```

**Key pattern**: Options are typed as `DialogSelectOption<{ providerID: string; modelID: string }>`:
```typescript
interface DialogSelectOption<T> {
  title: string       // Display name (e.g. "Claude Sonnet 4")
  value: T            // Selection value { providerID, modelID }
  description?: string // Subtitle (e.g. "(Favorite)")
  category?: string   // Category header (e.g. "Anthropic")
  footer?: string     // Right-aligned label (e.g. "Free")
  disabled?: boolean  // Non-selectable entries
  onSelect?: () => void // Called on selection
}
```

### 2.3 Selection Flow (`dialog-model.tsx:142-155`)

```typescript
function onSelect(providerID: string, modelID: string) {
  // 1. Update local state (per-agent model, add to recents)
  local.model.set({ providerID, modelID }, { recent: true })

  // 2. If the model has unselected variants → auto-open variant dialog
  const list = local.model.variant.list()
  if (cur === "default" || (cur && list.includes(cur))) {
    dialog.clear()
    return
  }
  if (list.length > 0) {
    dialog.replace(() => <DialogVariant />)
    return
  }

  // 3. Otherwise, close all dialogs
  dialog.clear()
}
```

### 2.4 Current Model Display

The `current` prop of `DialogSelect` highlights which model is currently active using a `●` indicator. The current model is resolved via priority chain (`local.tsx:236-244`):

```
Agent-specific model > Agent default model > CLI --model arg > opencode.json config model > Most recent valid model > First provider's default
```

### 2.5 In-List Actions (Footer)

The dialog supports footer actions that appear at the bottom:
- `ctrl+a` — "Connect provider" / "View all providers" → opens `DialogProvider`
- `ctrl+f` — "Favorite" — toggles the selected model as a favorite

---

## 3. Model Variant Selection

### 3.1 Triggering

1. **Auto-triggered** after model selection if the model has variants (`dialog-model.tsx:150-152`)
2. **Keybinding** `ctrl+t` — `variant.cycle` cycles through variants without opening a dialog
3. **Command** `/variants` — opens the variant dialog

### 3.2 Dialog Component (`dialog-variant.tsx`)

A minimal `DialogSelect<string>` with two types of options:
```typescript
const options = [
  {
    value: "default",
    title: "Default",
    onSelect: () => {
      dialog.clear()
      local.model.variant.set(undefined)  // undefined = use default
    },
  },
  ...local.model.variant.list().map((variant) => ({
    value: variant,
    title: variant,
    onSelect: () => {
      dialog.clear()
      local.model.variant.set(variant)
    },
  })),
]
```

### 3.3 Variant State (`local.tsx:362-405`)

```typescript
variant: {
  selected() {
    // Returns variant key for current model from store, or undefined
    const key = `${m.providerID}/${m.modelID}`
    return modelStore.variant[key]
  },
  list() {
    // Fetches variant keys from provider model info
    const provider = sync.data.provider.find(...)
    const info = provider?.models[m.modelID]
    return Object.keys(info?.variants ?? {})
  },
  set(value) {
    // Saves variant choice per-model: "providerID/modelID" -> variantKey
    setModelStore("variant", `${m.providerID}/${m.modelID}`, value ?? "default")
    save()
  },
  cycle() {
    // Cycles through: v1 → v2 → ... → vN → default → v1 ...
    const variants = this.list()
    if (!current) { this.set(variants[0]); return }
    const index = variants.indexOf(current)
    if (index === -1 || index === variants.length - 1) { this.set(undefined); return }
    this.set(variants[index + 1])
  },
}
```

**Key decision**: Variants are keyed by `"providerID/modelID"` string in a flat `Record<string, string>`.

---

## 4. Provider Connection & API Key Management

### 4.1 Triggering

1. **Command** `/connect` — `provider.connect` command
2. **Auto-connection** — when `sync.data.provider.length === 0` after bootstrap (first-run flow)
3. **From model dialog** — `ctrl+a` action button

### 4.2 Provider List (`dialog-provider.tsx:47-78`)

Providers are sorted by a priority map:
```typescript
const PROVIDER_PRIORITY = {
  opencode: 0, "opencode-go": 1, openai: 2,
  "github-copilot": 3, anthropic: 4, google: 5,
}
```

They are grouped into:
- **"Popular"** — known providers (those in the priority map)
- **"Providers"** — others

A **"Other"** option lets users enter a custom provider ID (validated via regex: `/^[a-z0-9][a-z0-9-_]*$/`).

Each option shows:
- Connected status: `✓` gutter indicator
- Description hints: "(Recommended)", "(API key)", "(ChatGPT Plus/Pro or API key)", "Low cost subscription for everyone"
- Console-managed org name in footer

### 4.3 Auth Flow Dispatch (`dialog-provider.tsx:145-220`)

When a provider is selected, auth methods are fetched from `sync.data.provider_auth[providerID]` (populated by `GET /provider/auth`). If no methods are configured, the default is `{ type: "api", label: "API key" }`.

```
Select Provider
    │
    ├── Is console-managed? → no-op (managed externally)
    │
    ├── Multiple auth methods? → Show method picker
    │       │
    │       ├── type: "api" → ApiMethod (prompt for key)
    │       │       └── Additional prompts? → Show DialogSelect/DialogPrompt
    │       │               for metadata fields (e.g. org_id, endpoint)
    │       │
    │       └── type: "oauth" 
    │               ├── Additional prompts? → Show DialogSelect/DialogPrompt
    │               ├── Authorize → POST /provider/{id}/oauth/authorize
    │               │
    │               ├── method: "code" → CodeMethod
    │               │   └── Show URL + instructions → prompt for code
    │               │       └── POST /provider/{id}/oauth/callback
    │               │
    │               └── method: "auto" → AutoMethod
    │                   └── Show URL + instructions → auto-poll callback
    │                       └── POST /provider/{id}/oauth/callback
    │
    └── type: "api" (default) → ApiMethod (prompt for key)
```

### 4.4 API Key Entry (`ApiMethod`, lines 352-418)

```typescript
function ApiMethod(props: { providerID, title, metadata?, custom? }) {
  return (
    <DialogPrompt
      title={props.title}
      placeholder="API key"
      description={providerSpecificDescription}
      onConfirm={async (value) => {
        // 1. Send API key to server
        await sdk.client.auth.set({
          providerID: props.providerID,
          auth: { type: "api", key: value, metadata: props.metadata },
        })

        // 2. Dispose current server instance
        await sdk.client.instance.dispose()

        // 3. Re-bootstrap to get updated provider state
        await sync.bootstrap()

        // 4. If custom provider not registered on server → show info toast
        if (props.custom && !providerExistsOnServer) {
          toast.show({ message: "Saved credential. Configure in opencode.json." })
          dialog.clear()
          return
        }

        // 5. Navigate to model selector for the newly-connected provider
        dialog.replace(() => <DialogModel providerID={props.providerID} />)
      }}
    />
  )
}
```

### 4.5 Server API Endpoints Used

| Operation | Endpoint | Method |
|-----------|----------|--------|
| Set API key | `/auth/{providerID}` | `PUT` |
| Start OAuth | `/provider/{providerID}/oauth/authorize` | `POST` |
| Complete OAuth | `/provider/{providerID}/oauth/callback` | `POST` |
| List providers | `/provider` | `GET` |
| Get provider configs | `/config/providers` | `GET` |
| Get auth methods | `/provider/auth` | `GET` |
| Dispose instance | `/instance/dispose` | `POST` |

### 4.6 Bootstrap Re-fetch (`sync.tsx:445-546`)

After connecting a provider, `sync.bootstrap()` re-fetches all server state:
```typescript
// Blocking (must complete before showing model list)
await sdk.client.config.providers({ workspace })    // Provider + model configs
await sdk.client.provider.list({ workspace })       // Available + connected providers
await sdk.client.app.agents({ workspace })          // Agent list
await sdk.client.config.get({ workspace })          // opencode.json config
await sdk.client.experimental.capabilities.get()    // Server capabilities
await sdk.client.experimental.console.get()         // Console state (org management)

// Non-blocking (fetched after UI is responsive)
await sdk.client.provider.auth({ workspace })       // Auth methods per provider
await sdk.client.command.list({ workspace })        // Available commands
await sdk.client.lsp.status({ workspace })          // LSP status
await sdk.client.mcp.status({ workspace })          // MCP status
await sdk.client.session.list(...)                  // Session list
await sdk.client.session.status({ workspace })      // Session statuses
await sdk.client.vcs.get({ workspace })             // VCS info
```

---

## 5. Generic Dialog Components

### 5.1 `DialogSelect<T>` (`ui/dialog-select.tsx`)

A highly reusable filtered select list component. Key features:

**Props:**
```typescript
interface DialogSelectProps<T> {
  title: string
  options: DialogSelectOption<T>[]
  placeholder?: string               // Search placeholder
  flat?: boolean                     // Remove category headers
  current?: T                        // Currently active value (shows ●)
  skipFilter?: boolean               // Hide search input
  renderFilter?: boolean             // Toggle search input
  preserveSelection?: boolean         // Keep selection when options change
  locked?: boolean                   // Disable interaction
  onSelect?: (option) => void        // Called on selection
  onFilter?: (query: string) => void // External filter hook
  onMove?: (option) => void          // Called when highlight moves
  actions?: {                        // Footer action buttons
    command: string                  // Keybinding command name
    title: string                    // Display label
    hidden?: boolean
    disabled?: boolean
    onTrigger: (option) => void
  }[]
  footerHints?: { title: string; label: string }[]
  bindings?: Binding[]               // Extra keybindings
  current?: T                        // Currently active value
}
```

**Navigation:**
- `↑`/`↓` — move selection by 1
- `pageup`/`pagedown` — move by 10
- `home`/`end` — first/last item
- `enter` — select
- `tab`/`shift+tab` — navigate between footer actions
- `escape` / `ctrl+c` — close dialog
- Mouse click/move — mouse-based selection
- Typing text — fuzzy filter

**Rendering structure:**
```
┌──────────────────────────────────────────┐
│  Title                              esc  │
│  [Filter input                      ]   │
├──────────────────────────────────────────┤
│  CATEGORY HEADER (accent color)          │
│  ● Current Model Title    Description    │
│    Active Model Title     Description    │  ← highlighted (primary bg)
│    Other Model Title      Description    │
│                                          │
│  NEXT CATEGORY                           │
│    Model Title            Free (footer)  │
│    ...                                   │
├──────────────────────────────────────────┤
│  Footer actions (left)  (right)          │
│  ctrl+a Connect      ● Current marker    │
│  ctrl+f Favorite                         │
└──────────────────────────────────────────┘
```

### 5.2 `DialogPrompt` (`ui/dialog-prompt.tsx`)

Single-line text input dialog for API keys, codes, etc.

```typescript
interface DialogPromptProps {
  title: string
  placeholder?: string
  value?: string           // Initial value
  busy?: boolean           // Show spinner, disable input
  busyText?: string        // Spinner label
  onConfirm?: (value: string) => void
  onCancel?: () => void
  description?: () => JSX  // Rich text/links above input
}
```

Can also be used programmatically with `.show()`:
```typescript
const value = await DialogPrompt.show(dialog, "API key", {
  placeholder: "Enter your key",
  description: () => <text>Get a key at https://...</text>,
})
if (value === null) return  // user cancelled
// use value
```

### 5.3 `Dialog` (Modal Stack, `ui/dialog.tsx`)

Stack-based dialog manager:
```typescript
dialog.replace(element)  // Replace entire stack with one dialog
dialog.clear()           // Close all dialogs
dialog.setSize("large")  // "medium" | "large" | "xlarge"
```

Uses SolidJS reactive store for the stack. Escape/ctrl+c pops the top dialog or calls `onClose`.

---

## 6. State Management & Persistence

### 6.1 Local State (`context/local.tsx`)

Stored in memory via SolidJS `createStore<{...}>()`:

```typescript
// Model store
model: Record<string, { providerID: string; modelID: string }>  // per-agent model
recent: { providerID: string; modelID: string }[]                 // up to 10
favorite: { providerID: string; modelID: string }[]
variant: Record<string, string | undefined>                       // "providerID/modelID" → variant
```

**Persisted** to `<state_dir>/model.json` (atomic write via temp file + rename):

```json
{
  "recent": [
    { "providerID": "anthropic", "modelID": "claude-sonnet-4-20250514" }
  ],
  "favorite": [
    { "providerID": "opencode", "modelID": "gemini-2.5-pro" }
  ],
  "variant": {
    "anthropic/claude-sonnet-4-20250514": "default"
  }
}
```

### 6.2 Server State (`context/sync.tsx`)

SolidJS store populated from API responses:
```typescript
provider: Provider[]                         // Configured providers with models
provider_next: ProviderListResponse          // All available + connected providers
provider_auth: Record<string, ProviderAuthMethod[]>  // Auth methods per provider
agent: Agent[]                              // Available agents
config: Config                              // opencode.json contents
console_state: ConsoleState                 // Console-managed provider state
```

### 6.3 SDK Client (`context/sdk.tsx`)

Typed HTTP client generated from the OpenCode OpenAPI spec using `@hey-api/openapi-ts`. Provides typed methods like:
```typescript
sdk.client.auth.set({ providerID, auth })           // PUT /auth/{id}
sdk.client.provider.list({ workspace })             // GET /provider
sdk.client.provider.auth({ workspace })             // GET /provider/auth
sdk.client.provider.oauth.authorize({...})          // POST /provider/{id}/oauth/authorize
sdk.client.provider.oauth.callback({...})           // POST /provider/{id}/oauth/callback
sdk.client.config.providers({ workspace })          // GET /config/providers
sdk.client.instance.dispose()                       // POST /instance/dispose
```

---

## 7. Design Patterns Summary for Go Implementation

### 7.1 Model Selection UI

**Pattern**: A filterable list with categorized options, current-value highlighting, and inline actions.

**Recommended approach for Go/web**:
- Fetch providers+models from server (single API call or combined)
- Build a flat option list with category headers
- Implement client-side fuzzy filtering (e.g., Fuse.js for web, or server-side for simple cases)
- Show recents+favorites first, then all models grouped by provider
- Current model highlighted with a visual indicator (dot, checkmark, etc.)
- Model selection triggers: state update + auto-navigate to variant selection if needed

### 7.2 Variant Selection

**Pattern**: Simple select between "Default" and each available variant.

**Recommended approach for Go/web**:
- Store variants per model: `"providerID/modelID" → variantKey` in a flat map
- Default = no variant set (use server default)
- Variant info sourced from model metadata in provider config

### 7.3 API Key Management

**Pattern**: Provider list → auth method selection → prompt for key/code → save to server → refresh state → navigate to model selector.

**Flow for Go/web**:
1. Fetch provider list (available + connected) and auth methods
2. Show prioritized provider list grouped as "Popular" / "Other"
3. Mark connected providers with a checkmark
4. On select: show auth method picker (API key vs OAuth)
5. For API key: prompt for key, send `PUT /auth/{providerID}`
6. For OAuth: `POST /provider/{id}/oauth/authorize`, show URL, poll or prompt for callback code
7. After success: re-fetch provider list, navigate to model selector

### 7.4 State Persistence

**Pattern**: JSON file with atomic writes for local state (favorites, recents, variants). Server API for global state (providers, agents, config).

**Key insight**: Keep local user preferences separate from server configuration. User preferences (which model they like, recent picks) live in a local JSON file. Provider connections (API keys, OAuth tokens) live on the server.

### 7.5 Dialog/Modal System

**Pattern**: Stack-based modal system with `replace()` and `clear()` semantics. Each dialog is a self-contained component rendered on top of the current view.

**Recommended**: Any modal/dialog library that supports stack behavior. Key operations:
- `replace(content)` — push a new dialog onto stack
- `clear()` — pop all dialogs from stack
- Dialogs pass through callbacks for multi-step flows (e.g., provider → auth method → API key)

---

## 8. File Reference Index

| File | Description |
|------|-------------|
| `packages/tui/src/component/dialog-model.tsx` | Model selection dialog (197 lines) |
| `packages/tui/src/component/dialog-variant.tsx` | Variant selection dialog (39 lines) |
| `packages/tui/src/component/dialog-provider.tsx` | Provider connection/API key dialog (469 lines) |
| `packages/tui/src/ui/dialog-select.tsx` | Generic filterable select list (790 lines) |
| `packages/tui/src/ui/dialog-prompt.tsx` | Text input dialog (126 lines) |
| `packages/tui/src/ui/dialog.tsx` | Modal dialog stack manager (231 lines) |
| `packages/tui/src/context/local.tsx` | Local state store (542 lines) |
| `packages/tui/src/context/sync.tsx` | Server data store + bootstrap (666 lines) |
| `packages/tui/src/context/sdk.tsx` | SDK client wrapper (151 lines) |
| `packages/tui/src/util/persistence.ts` | JSON file persistence (33 lines) |
| `packages/tui/src/app.tsx` | Main app, command wiring (~1134 lines) |
| `packages/tui/src/config/keybind.ts` | Keybinding definitions (~471 lines) |
| `packages/sdk/js/src/v2/gen/sdk.gen.ts` | SDK client (generated from OpenAPI) |
| `packages/sdk/js/src/v2/gen/types.gen.ts` | SDK types (generated from OpenAPI) |
