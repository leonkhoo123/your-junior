# Per-Session Workspace (Directory) Selection

## Overview

OpenCode supports binding each AI session to a specific workspace directory. This allows isolating user projects under `project/` so each session can only access its own subtree, enforced by `external_directory: deny`.

## OpenCode API Support

### V1 API (currently used by your-junior)

```
POST /session?directory=/path/to/workspace
```

Directory passed as a query parameter.

### V2 API (newer)

```
POST /api/session
Body: {
  "location": {
    "directory": "/absolute/path/to/workspace",
    "workspaceID": "optional-id"
  }
}
```

If no `directory` is specified, OpenCode defaults to the server process's `cwd` (set by `OPENCODE_WORKDIR` or `./project`).

## Implementation Plan

### 1. Go Backend: Client Layer (`backend/internal/opencode/client.go`)

Add a `directory` parameter to `CreateSession`:

```go
func (c *Client) CreateSession(model, variant, directory string) (*SessionResponse, error) {
    url := fmt.Sprintf("%s/session?directory=%s", c.baseURL, url.QueryEscape(directory))
    // ... rest of body unchanged
}
```

### 2. Go Backend: WebSocket Layer (`backend/internal/opencode/ws.go`)

Add `Directory` field to messages:

```go
type WSMessage struct {
    Type      WSMessageType `json:"type"`
    Directory string        `json:"directory,omitempty"`
    // ... other fields
}
```

### 3. Go Backend: Controller (`backend/internal/controller/opencode.go`)

Read `directory` from the incoming `create_session` message and pass it through:

```go
case opencode.WSTypeCreateSession:
    directory := msg.Directory
    if directory == "" {
        directory = managerCfg.WorkDir  // fallback to server default
    }
    session, err := h.client.CreateSession(h.manager.GetModel(), h.variant, directory)
```

### 4. Frontend: Workspace Selector

Add a UI element (dropdown or input) in the chat pane for the user to select/enter a workspace path. Send it with the `create_session` WebSocket message:

```typescript
send({
  type: "create_session",
  directory: selectedWorkspace, // e.g., "/home/.../your-junior/project/user-123"
})
```

### 5. Lock Down Access

Place this in each workspace's `.opencode/opencode.jsonc`:

```json
{
  "permission": {
    "external_directory": "deny"
  }
}
```

Or generate it programmatically when a workspace is created.

## How OpenCode Enforces the Boundary

| Path Type | Behavior |
|-----------|----------|
| Relative, inside workspace | Allowed |
| Relative, escaping (e.g. `../../etc`) | **Hard blocked** (fatal error) |
| Absolute, inside workspace | Allowed |
| Absolute, outside workspace | **Blocked** by `external_directory: deny` |
| Symlink from inside to outside | **Hard blocked** (V2: `location_escape`) |

### Key source files in OpenCode

- `packages/core/src/fs-util.ts:270` — `contains(parent, child)` path containment check
- `packages/core/src/location-mutation.ts:120` — `LocationMutation.resolve()` hard-blocks relative escapes
- `packages/core/src/filesystem.ts:65` — V2 FileSystem hard path escape die
- `packages/opencode/src/tool/external-directory.ts` — V1 external_directory permission assertion
- `packages/core/src/plugin/agent.ts:106` — default permission: `external_directory: ask`
