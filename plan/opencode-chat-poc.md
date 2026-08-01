# OpenCode Chat Integration Plan

## Overview

Transform the existing HomePage into an AI chat interface powered by opencode server. All communication flows through the Go backend, which manages the opencode server lifecycle and proxies real-time events via WebSocket.

## Architecture

```
React Frontend (WebSocket) <--ws--> Go Backend (Gin) <--http/sse--> opencode serve (localhost:4096)
```

**Flow:**
1. User clicks "Start OpenCode" on frontend
2. Go backend spawns `opencode serve --port 4096 --hostname 127.0.0.1 --cors http://localhost:5173` as subprocess
3. Go backend creates an opencode session via REST API
4. Frontend connects to Go backend via WebSocket
5. User sends chat message -> Go backend -> POST to opencode `/session/:id/message`
6. Go backend subscribes to opencode SSE `/event` stream, proxies events to frontend via WebSocket
7. Frontend renders streaming responses in real-time

---

## Step 1: Create `project/` Directory

Create `project/` at repo root as opencode's working directory.

---

## Step 2: Go Backend - OpenCode Server Manager

**File: `backend/internal/opencode/manager.go`**

- Struct `Manager` to manage opencode server subprocess lifecycle
- `Start()` - spawns `opencode serve` process
- `Stop()` - kills the process gracefully
- `IsRunning()` - health check via `GET /global/health`
- `GetBaseURL()` - returns `http://127.0.0.1:4096`
- Store PID for cleanup
- Health poll until server is ready (timeout ~10s)

**File: `backend/internal/opencode/client.go`**

- HTTP client wrapper for opencode REST API
- `CreateSession(title string)` -> `POST /session`
- `SendMessage(sessionID, text string)` -> `POST /session/:id/message`
- `SendPromptAsync(sessionID, text string)` -> `POST /session/:id/prompt_async`
- `ListMessages(sessionID string)` -> `GET /session/:id/message`
- `GetProviders()` -> `GET /provider`
- `AbortSession(sessionID string)` -> `POST /session/:id/abort`

---

## Step 3: Go Backend - WebSocket Hub

**File: `backend/internal/opencode/ws.go`**

- WebSocket hub pattern (connection management)
- `Hub` struct with client registration/unregistration
- `Client` struct per WebSocket connection (read/write pumps)
- Message types for WebSocket protocol:
  - `start_server` - frontend requests opencode start
  - `stop_server` - frontend requests opencode stop
  - `send_message` - frontend sends chat message
  - `create_session` - create new chat session
  - `server_status` - backend pushes server status
  - `chat_message` - backend pushes AI response (streaming chunks)
  - `session_info` - backend pushes session metadata
  - `error` - error messages

---

## Step 4: Go Backend - SSE Proxy

**File: `backend/internal/opencode/sse_proxy.go`**

- Subscribes to opencode `GET /event` SSE stream
- Parses SSE events (event type + JSON data)
- Filters for relevant events:
  - `message.created` - new message from AI
  - `message.updated` - message content update (streaming)
  - `message.completed` - message finished
  - `session.updated` - session state change
- Forwards parsed events to WebSocket clients as JSON

---

## Step 5: Go Backend - Routes & Wiring

**File: `backend/internal/controller/opencode.go`**

- `SetupOpencodeRoutes(router, hub)` - register WebSocket endpoint
- `GET /api/opencode/ws` - WebSocket upgrade endpoint
- `GET /api/opencode/status` - HTTP endpoint for server status (non-ws fallback)

**Wire into `backend/cmd/main.go`:**
- Initialize opencode Manager on startup (but don't auto-start)
- Initialize WebSocket Hub
- Register routes
- Cleanup on shutdown (stop opencode server)

**Dependencies to add:**
- `github.com/gorilla/websocket` - WebSocket support

---

## Step 6: Frontend - WebSocket Hook

**File: `frontend/src/hooks/useOpencodeWebSocket.ts`**

- Custom hook for WebSocket connection to `ws://localhost:8080/api/opencode/ws`
- Auto-reconnect logic
- Send/receive message helpers
- Connection state management (connecting, connected, disconnected)
- Message handler callbacks for different event types

---

## Step 7: Frontend - Chat UI Components

**File: `frontend/src/components/opencode/ChatPanel.tsx`**

- Main chat container
- Message list with scroll-to-bottom
- Input area with send button
- Markdown rendering for AI responses (use existing `react-markdown` or simple `<pre>` for POC)
- Loading/streaming indicator

**File: `frontend/src/components/opencode/ServerControl.tsx`**

- "Start OpenCode" / "Stop OpenCode" button
- Server status indicator (stopped, starting, running, error)
- Model info display (deepseek/deepseek-v4-pro)

**File: `frontend/src/components/opencode/MessageBubble.tsx`**

- Individual message bubble (user vs AI styling)
- Streaming text animation
- Tool call display (if AI uses tools, show expandable section)

---

## Step 8: Frontend - Update HomePage

**Modify: `frontend/src/pages/HomePage.tsx`**

- Replace current content with chat interface
- Layout: ServerControl bar at top, ChatPanel fills remaining space
- Wire WebSocket hook to chat components

---

## Step 9: Configuration

**File: `backend/internal/opencode/config.go`**

- Opencode server port: `4096` (configurable via env `OPENCODE_PORT`)
- Opencode hostname: `127.0.0.1`
- Default model: `deepseek/deepseek-v4-pro`
- Working directory for opencode: `./project/` (relative to backend root)
- WebSocket allowed origins from existing CORS config

---

## WebSocket Protocol (JSON)

### Client -> Server
```json
{"type": "start_server"}
{"type": "stop_server"}
{"type": "create_session", "data": {"title": "Chat 1"}}
{"type": "send_message", "data": {"session_id": "ses_xxx", "text": "Hello!"}}
```

### Server -> Client
```json
{"type": "server_status", "data": {"status": "running", "model": "deepseek/deepseek-v4-pro"}}
{"type": "session_created", "data": {"session_id": "ses_xxx"}}
{"type": "chat_message", "data": {"session_id": "ses_xxx", "role": "assistant", "content": "...", "streaming": true}}
{"type": "chat_complete", "data": {"session_id": "ses_xxx", "message_id": "msg_xxx"}}
{"type": "error", "data": {"message": "..."}}
```

---

## Implementation Order

| # | Task | Files | Est. Effort |
|---|------|-------|-------------|
| 1 | Create `project/` directory | `project/` | 1 min |
| 2 | Go: opencode manager (start/stop process) | `backend/internal/opencode/manager.go` | 30 min |
| 3 | Go: opencode HTTP client | `backend/internal/opencode/client.go` | 20 min |
| 4 | Go: WebSocket hub | `backend/internal/opencode/ws.go` | 30 min |
| 5 | Go: SSE proxy | `backend/internal/opencode/sse_proxy.go` | 25 min |
| 6 | Go: routes + wire into main | `backend/internal/controller/opencode.go`, `backend/cmd/main.go` | 15 min |
| 7 | Frontend: WebSocket hook | `frontend/src/hooks/useOpencodeWebSocket.ts` | 20 min |
| 8 | Frontend: Chat components | `frontend/src/components/opencode/` | 40 min |
| 9 | Frontend: Update HomePage | `frontend/src/pages/HomePage.tsx` | 15 min |
| 10 | Test end-to-end | Manual testing | 15 min |

**Total estimate: ~3 hours**

---

## Verification

1. `cd backend && go build ./cmd/main.go` - compiles
2. `cd frontend && npm run build` - builds
3. Manual test: Start backend -> Open frontend -> Click "Start OpenCode" -> Send message -> See streaming response
4. Test: Stop server -> Restart -> New session works
