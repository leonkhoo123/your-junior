# SDK

Type-safe JS client for opencode server.

The opencode JS/TS SDK provides a type-safe client for interacting with the server. Use it to build integrations and control opencode programmatically.

[Learn more about the server](/docs/server). For examples, check out the [projects](/docs/ecosystem#projects) built by the community.

---

## Install

```bash
npm install @opencode-ai/sdk
```

---

## Create client

Create an instance of opencode:

```typescript
import { createOpencode } from "@opencode-ai/sdk"
const { client } = await createOpencode()
```

This starts both a server and a client.

### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `hostname` | `string` | Server hostname | `127.0.0.1` |
| `port` | `number` | Server port | `4096` |
| `signal` | `AbortSignal` | Abort signal for cancellation | `undefined` |
| `timeout` | `number` | Timeout in ms for server start | `5000` |
| `config` | `Config` | Configuration object | `{}` |

---

## Config

You can pass a configuration object to customize behavior:

```typescript
import { createOpencode } from "@opencode-ai/sdk"

const opencode = await createOpencode({
  hostname: "127.0.0.1",
  port: 4096,
  config: {
    model: "anthropic/claude-3-5-sonnet-20241022",
  },
})

console.log(`Server running at ${opencode.server.url}`)
opencode.server.close()
```

---

## Client only

If you already have a running instance of opencode, you can create a client instance to connect to it:

```typescript
import { createOpencodeClient } from "@opencode-ai/sdk"

const client = createOpencodeClient({
  baseUrl: "http://localhost:4096",
})
```

### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `baseUrl` | `string` | URL of the server | `http://localhost:4096` |
| `fetch` | `function` | Custom fetch implementation | `globalThis.fetch` |
| `parseAs` | `string` | Response parsing method | `auto` |
| `responseStyle` | `string` | Return style: `data` or `fields` | `fields` |
| `throwOnError` | `boolean` | Throw errors instead of return | `false` |

---

## Types

The SDK includes TypeScript definitions for all API types. Import them directly:

```typescript
import type { Session, Message, Part } from "@opencode-ai/sdk"
```

All types are generated from the server's OpenAPI specification.

---

## Errors

```typescript
try {
  await client.session.get({ path: { id: "invalid-id" } })
} catch (error) {
  console.error("Failed to get session:", (error as Error).message)
}
```

---

## Structured Output

You can request structured JSON output from the model by specifying a `format` with a JSON schema.

```typescript
const result = await client.session.prompt({
  path: { id: sessionId },
  body: {
    parts: [{ type: "text", text: "Research Anthropic and provide company info" }],
    format: {
      type: "json_schema",
      schema: {
        type: "object",
        properties: {
          company: { type: "string", description: "Company name" },
          founded: { type: "number", description: "Year founded" },
          products: {
            type: "array",
            items: { type: "string" },
            description: "Main products",
          },
        },
        required: ["company", "founded"],
      },
    },
  },
})

console.log(result.data.info.structured_output)
// { company: "Anthropic", founded: 2021, products: ["Claude", "Claude API"] }
```

### Output Format Types

| Type | Description |
|------|-------------|
| `text` | Default. Standard text response (no structured output) |
| `json_schema` | Returns validated JSON matching the provided schema |

### JSON Schema Format

| Field | Type | Description |
|-------|------|-------------|
| `type` | `'json_schema'` | Required. Specifies JSON schema mode |
| `schema` | `object` | Required. JSON Schema object defining the output structure |
| `retryCount` | `number` | Optional. Number of validation retries (default: 2) |

### Best Practices

1. **Provide clear descriptions** in your schema properties
2. **Use `required`** to specify which fields must be present
3. **Keep schemas focused** - complex nested schemas may be harder
4. **Set appropriate `retryCount`** - increase for complex schemas

---

## APIs

The SDK exposes all server APIs through a type-safe client.

### Global

| Method | Description | Response |
|--------|-------------|----------|
| `global.health()` | Check server health and version | `{ healthy: true, version: string }` |

### App

| Method | Description | Response |
|--------|-------------|----------|
| `app.log()` | Write a log entry | `boolean` |
| `app.agents()` | List all available agents | `Agent[]` |

### Project

| Method | Description | Response |
|--------|-------------|----------|
| `project.list()` | List all projects | `Project[]` |
| `project.current()` | Get current project | `Project` |

### Path

| Method | Description | Response |
|--------|-------------|----------|
| `path.get()` | Get current path | `Path` |

### Config

| Method | Description | Response |
|--------|-------------|----------|
| `config.get()` | Get config info | `Config` |
| `config.providers()` | List providers and default models | `{ providers: Provider[], default: {...} }` |

### Sessions

| Method | Description |
|--------|-------------|
| `session.list()` | List sessions |
| `session.get({ path })` | Get session |
| `session.children({ path })` | List child sessions |
| `session.create({ body })` | Create session |
| `session.delete({ path })` | Delete session |
| `session.update({ path, body })` | Update session properties |
| `session.init({ path, body })` | Analyze app and create `AGENTS.md` |
| `session.abort({ path })` | Abort a running session |
| `session.share({ path })` | Share session |
| `session.unshare({ path })` | Unshare session |
| `session.summarize({ path, body })` | Summarize session |
| `session.messages({ path })` | List messages in a session |
| `session.message({ path })` | Get message details |
| `session.prompt({ path, body })` | Send prompt message (supports `outputFormat` for structured output, `noReply: true` for context-only) |
| `session.command({ path, body })` | Send command to session |
| `session.shell({ path, body })` | Run a shell command |
| `session.revert({ path, body })` | Revert a message |
| `session.unrevert({ path })` | Restore reverted messages |
| `postSessionByIdPermissionsByPermissionId({ path, body })` | Respond to a permission request |

```typescript
// Create and manage sessions
const session = await client.session.create({
  body: { title: "My session" },
})

const sessions = await client.session.list()

// Send a prompt message
const result = await client.session.prompt({
  path: { id: session.id },
  body: {
    model: { providerID: "anthropic", modelID: "claude-3-5-sonnet-20241022" },
    parts: [{ type: "text", text: "Hello!" }],
  },
})

// Inject context without triggering AI response
await client.session.prompt({
  path: { id: session.id },
  body: {
    noReply: true,
    parts: [{ type: "text", text: "You are a helpful assistant." }],
  },
})
```

### Files

| Method | Description | Response |
|--------|-------------|----------|
| `find.text({ query })` | Search for text in files | Match objects |
| `find.files({ query })` | Find files and directories by name | `string[]` |
| `find.symbols({ query })` | Find workspace symbols | `Symbol[]` |
| `file.read({ query })` | Read a file | `{ type, content }` |
| `file.status({ query? })` | Get status for tracked files | `File[]` |

```typescript
// Search and read files
const textResults = await client.find.text({
  query: { pattern: "function.*opencode" },
})

const content = await client.file.read({
  query: { path: "src/index.ts" },
})
```

### TUI

| Method | Description |
|--------|-------------|
| `tui.appendPrompt({ body })` | Append text to the prompt |
| `tui.openHelp()` | Open the help dialog |
| `tui.openSessions()` | Open the session selector |
| `tui.openThemes()` | Open the theme selector |
| `tui.openModels()` | Open the model selector |
| `tui.submitPrompt()` | Submit the current prompt |
| `tui.clearPrompt()` | Clear the prompt |
| `tui.executeCommand({ body })` | Execute a command |
| `tui.showToast({ body })` | Show toast notification |

### Auth

```typescript
await client.auth.set({
  path: { id: "anthropic" },
  body: { type: "api", key: "your-api-key" },
})
```

### Events

```typescript
// Listen to real-time events
const events = await client.event.subscribe()
for await (const event of events.stream) {
  console.log("Event:", event.type, event.properties)
}
```
