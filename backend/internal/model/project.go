package model

import "time"

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
	ID                int64     `json:"id"`
	ProjectID         int64     `json:"project_id"`
	BranchName        string    `json:"branch_name"`
	WorktreePath      string    `json:"worktree_path"`
	OpencodeSessionID *string   `json:"opencode_session_id,omitempty"`
	Status            string    `json:"status"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
	ProjectName       string    `json:"project_name,omitempty"`
}
