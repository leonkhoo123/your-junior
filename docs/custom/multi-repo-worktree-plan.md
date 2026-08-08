# Multi-Repo Worktree Plan

## Overview

Replace the current flat `git clone` approach with a **bare repo + git worktree** model. One OpenCode server, multiple sessions, each session bound to a specific worktree directory (isolating repos/branches from each other).

```
project/
├── repo-a.git/           # bare clone (git objects only, no working tree)
├── repo-a/
│   ├── main/             # worktree: main branch checkout
│   └── feature-x/        # worktree: feature-x branch checkout
├── repo-b.git/           # bare clone
├── repo-b/
│   ├── main/             # worktree
│   └── fix-auth/         # worktree
```

---

## 1. Data Model (SQLite)

### Migration: `00004_worktrees.sql`

```sql
-- Tracks git repositories (bare clones)
CREATE TABLE IF NOT EXISTS projects (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    git_url     TEXT    NOT NULL,
    bare_path   TEXT    NOT NULL UNIQUE,  -- e.g. project/repo-a.git
    status      TEXT    NOT NULL DEFAULT 'active',  -- active, cloning, error, archived
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- Tracks individual worktrees (one per branch)
CREATE TABLE IF NOT EXISTS worktrees (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id           INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    branch_name          TEXT    NOT NULL,  -- e.g. "main", "feature-x"
    worktree_path        TEXT    NOT NULL UNIQUE,  -- e.g. project/repo-a/main
    opencode_session_id  TEXT,   -- current session ID (NULL = no active session)
    status               TEXT    NOT NULL DEFAULT 'creating',  -- creating, active, idle, error, removed
    created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_worktrees_project ON worktrees(project_id);
CREATE INDEX IF NOT EXISTS idx_worktrees_session ON worktrees(opencode_session_id);
```

### Go models (`internal/model/project.go`)

```go
type Project struct {
    ID        int64     `json:"id"`
    Name      string    `json:"name"`
    GitURL    string    `json:"git_url"`
    BarePath  string    `json:"bare_path"`
    Status    string    `json:"status"`
    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}

type Worktree struct {
    ID                int64      `json:"id"`
    ProjectID         int64      `json:"project_id"`
    BranchName        string     `json:"branch_name"`
    WorktreePath      string     `json:"worktree_path"`
    OpencodeSessionID *string    `json:"opencode_session_id,omitempty"`
    Status            string     `json:"status"`
    CreatedAt         time.Time  `json:"created_at"`
    UpdatedAt         time.Time  `json:"updated_at"`
    // Joined fields
    ProjectName       string     `json:"project_name,omitempty"`
}
```

---

## 2. Backend Changes

### 2a. Repository layer

New files:
- `internal/repository/project_repository.go` — CRUD for projects table
- `internal/repository/worktree_repository.go` — CRUD for worktrees table

### 2b. Service layer (new)

New files:
- `internal/service/project_service.go` — business logic for adding/listing/removing projects
- `internal/service/worktree_service.go` — business logic for creating/listing/removing worktrees

Key operations:
```go
// AddProject clones a bare repo and inserts DB row
func (s *ProjectService) AddProject(gitURL string) (*model.Project, error)

// ListProjects returns all active projects
func (s *ProjectService) ListProjects() ([]*model.Project, error)

// RemoveProject deletes bare repo + all worktrees + DB rows
func (s *ProjectService) RemoveProject(id int64) error

// CreateWorktree creates git worktree for a project+branch, creates DB row
func (s *WorktreeService) CreateWorktree(projectID int64, branchName string) (*model.Worktree, error)

// ListWorktrees returns worktrees for a project (optionally all)
func (s *WorktreeService) ListWorktrees(projectID int64) ([]*model.Worktree, error)

// RemoveWorktree prunes git worktree and marks DB row as removed
func (s *WorktreeService) RemoveWorktree(id int64) error

// BindSession links an OpenCode session ID to a worktree
func (s *WorktreeService) BindSession(worktreeID int64, sessionID string) error

// UnbindSession clears session from worktree
func (s *WorktreeService) UnbindSession(worktreeID int64) error
```

### 2c. Git operations (new file: `internal/service/git_ops.go`)

```go
// BareClone creates a bare clone of a git repo
func BareClone(gitURL, barePath string) error

// FetchBranches fetches remote and lists available branches from bare repo
func FetchBranches(barePath string) ([]string, error)

// AddWorktree creates a git worktree from the bare repo
func AddWorktree(barePath, worktreePath, branchName string) error

// RemoveWorktree prunes a git worktree
func PruneWorktree(worktreePath string, barePath string) error
```

### 2d. Controller changes

Replace the current `git.go` controller:

**New routes:**
```
GET    /api/projects                    → list projects with worktrees
POST   /api/projects                    → add project (bare clone + fetch)
DELETE /api/projects/:id                → remove project (cleanup bare + worktrees)
POST   /api/projects/:id/branches       → fetch branches from remote
GET    /api/projects/:id/branches       → list available branches
POST   /api/projects/:id/worktrees      → create worktree for a branch
DELETE /api/worktrees/:id               → remove worktree
POST   /api/worktrees/:id/session       → create session & bind to worktree
```

### 2e. OpenCode session binding

Modify the `create_session` handler in `opencode.go`:
- Accept a `worktree_id` in the WS message
- Look up the worktree's `worktree_path` from DB
- Pass `worktree_path` as `location.directory` in the session create body
- After session created, call `BindSession(worktreeID, sessionID)` to store the link

---

## 3. Frontend Changes

### 3a. Current state
- `GitClonePane.tsx` shows flat list of dirs under `project/` with "clone" button
- Single project selection → single chat pane

### 3b. New state (confirmed Q3: single chat pane, tree navigation)

**Project panel (left):**
- Top level: list of projects (repo name + status)
- Click project → expands inline to show its worktrees
- Each worktree shows: branch name, status indicator, OpenCode session status
- "Fetch Branches" button on each project (or auto-fetch)
- "New Worktree" button per project → opens branch selector

**Chat panel (right):**
- Single chat pane — shows session for the currently selected worktree
- Header shows `project-name / branch-name`
- Switching worktrees = switching sessions (clear chat, load new session)

### 3c. New components needed

```
components/home/
├── ProjectPanel.tsx          → sidebar with project list
├── ProjectItem.tsx           → single project row (click to expand/collapse worktrees)
├── WorktreeItem.tsx          → single worktree row (branch name, click to open session)
├── WorktreeList.tsx          → expanded list of worktrees for a project
├── AddProjectDialog.tsx      → dialog to paste git URL + name
├── BranchSelector.tsx        → dropdown: fetch remote branches, search, create new branch
```

### 3d. State flow

```
User adds project "my-app"
  → POST /api/projects { url: "https://github.com/..." }
  → Backend: git clone --bare → inserts projects row
  → Frontend: project appears in list

User clicks project "my-app" → expands to show worktrees
  → GET /api/projects/:id/worktrees
  → Backend: returns worktrees for this project
  → Frontend: shows existing worktrees (maybe none yet)

User clicks "New Worktree" → BranchSelector opens
  → GET /api/projects/:id/branches
  → Backend: git fetch --all, git branch -r → returns branch list
  → Dropdown shows branches + search input + "Create new branch" option

User selects "feature-x" → creates worktree
  → POST /api/projects/:id/worktrees { branch: "feature-x" }
  → Backend: git worktree add, inserts worktrees row
  → Frontend: worktree appears under project

User clicks worktree "feature-x"
  → Frontend sends WS create_session with directory=worktree_path
  → Backend: Creates OpenCode session + binds to worktree (stores session_id in DB)
  → Frontend: chat pane opens with session
```

### 3e. File changes

| Remove | Add / Modify |
|--------|--------------|
| `GitClonePane.tsx` (removed) | `ProjectPanel.tsx` (new) |
| | `ProjectItem.tsx` (new) |
| | `WorktreeItem.tsx` (new) |
| | `WorktreeList.tsx` (new) |
| | `AddProjectDialog.tsx` (new) |
| | `BranchSelector.tsx` (new) |
| `HomePage.tsx` (modified) | Nested project→worktree selection + single chat pane |

---

## 4. Confirmation Questions — RESOLVED

| # | Question | Decision |
|---|----------|----------|
| Q1 | Bare repo migration | **Start fresh** — re-add repos via UI |
| Q2 | Worktree lifecycle on tab close | **Persist always** — removal/merge workflow comes later |
| Q3 | Multi-pane support | **Single chat pane** — desktop flow: project list → click project → worktree list → click worktree → chat |
| Q4 | Branch discovery | **Dropdown + search + create new** — fetch remote branches, searchable dropdown, plus option to create new branch |
| Q5 | Dirty worktree removal | **Skip for now** — removal/merge workflow is future work |
| Q6 | Single server | **Yes** — one `opencode serve` process, session-level isolation via `location.directory` |

---

## 5. Implementation Order

| Phase | What | Files Affected |
|-------|------|----------------|
| 1 | DB migration + models | migration .sql, `model/project.go` |
| 2 | Project/worktree repositories | `repository/project_repository.go`, `repository/worktree_repository.go` |
| 3 | Git operations (bare clone, worktree add, branch fetch) | `service/git_ops.go` |
| 4 | Project/worktree services | `service/project_service.go`, `service/worktree_service.go` |
| 5 | New controller routes (projects, worktrees, branches) | `controller/git.go` (rewrite) |
| 6 | Session binding in controller | `controller/opencode.go` (modify `create_session`) |
| 7 | Frontend project panel + worktree tree | `ProjectPanel.tsx`, sub-components |
| 8 | Frontend branch selector (dropdown + search + create) | `BranchSelector.tsx` |
| 9 | HomePage rework (tree nav + single chat pane) | `HomePage.tsx` |
| 10 | Cleanup old code | Remove `GitClonePane.tsx`, old clone logic |

**Deferred (future work):**
- Worktree merge into main (PR-like workflow)
- Worktree removal/prune
- Uncommitted change handling on removal
