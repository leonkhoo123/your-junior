package repository

import (
	"database/sql"
	"fmt"
	"time"

	"your-junior/internal/model"
)

type WorktreeRepository interface {
	Create(wt *model.Worktree) error
	GetByID(id int64) (*model.Worktree, error)
	ListByProject(projectID int64) ([]*model.Worktree, error)
	ListAllWithProjectName() ([]*model.Worktree, error)
	UpdateStatus(id int64, status string) error
	Delete(id int64) error
	BindSession(id int64, sessionID string) error
	UnbindSession(id int64) error
	GetBySessionID(sessionID string) (*model.Worktree, error)
}

type SQLiteWorktreeRepo struct {
	DB *sql.DB
}

func NewSQLiteWorktreeRepo(db *sql.DB) *SQLiteWorktreeRepo {
	return &SQLiteWorktreeRepo{DB: db}
}

func (r *SQLiteWorktreeRepo) Create(wt *model.Worktree) error {
	result, err := r.DB.Exec(
		`INSERT INTO worktrees (project_id, branch_name, worktree_path, status) VALUES (?, ?, ?, ?)`,
		wt.ProjectID, wt.BranchName, wt.WorktreePath, wt.Status,
	)
	if err != nil {
		return fmt.Errorf("failed to create worktree: %w", err)
	}
	id, err := result.LastInsertId()
	if err != nil {
		return fmt.Errorf("failed to get worktree ID: %w", err)
	}
	wt.ID = id
	return nil
}

func (r *SQLiteWorktreeRepo) GetByID(id int64) (*model.Worktree, error) {
	var wt model.Worktree
	err := r.DB.QueryRow(
		`SELECT w.id, w.project_id, w.branch_name, w.worktree_path, w.opencode_session_id,
		        w.status, w.created_at, w.updated_at, p.name
		 FROM worktrees w JOIN projects p ON w.project_id = p.id
		 WHERE w.id = ?`, id,
	).Scan(&wt.ID, &wt.ProjectID, &wt.BranchName, &wt.WorktreePath, &wt.OpencodeSessionID,
		&wt.Status, &wt.CreatedAt, &wt.UpdatedAt, &wt.ProjectName)
	if err != nil {
		return nil, fmt.Errorf("failed to get worktree by ID %d: %w", id, err)
	}
	return &wt, nil
}

func (r *SQLiteWorktreeRepo) ListByProject(projectID int64) ([]*model.Worktree, error) {
	rows, err := r.DB.Query(
		`SELECT w.id, w.project_id, w.branch_name, w.worktree_path, w.opencode_session_id,
		        w.status, w.created_at, w.updated_at, p.name
		 FROM worktrees w JOIN projects p ON w.project_id = p.id
		 WHERE w.project_id = ? AND w.status != 'removed'
		 ORDER BY w.branch_name`, projectID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to list worktrees for project %d: %w", projectID, err)
	}
	defer rows.Close()

	var worktrees []*model.Worktree
	for rows.Next() {
		var wt model.Worktree
		if err := rows.Scan(&wt.ID, &wt.ProjectID, &wt.BranchName, &wt.WorktreePath, &wt.OpencodeSessionID,
			&wt.Status, &wt.CreatedAt, &wt.UpdatedAt, &wt.ProjectName); err != nil {
			return nil, fmt.Errorf("failed to scan worktree row: %w", err)
		}
		worktrees = append(worktrees, &wt)
	}
	return worktrees, rows.Err()
}

func (r *SQLiteWorktreeRepo) ListAllWithProjectName() ([]*model.Worktree, error) {
	rows, err := r.DB.Query(
		`SELECT w.id, w.project_id, w.branch_name, w.worktree_path, w.opencode_session_id,
		        w.status, w.created_at, w.updated_at, p.name
		 FROM worktrees w JOIN projects p ON w.project_id = p.id
		 WHERE w.status != 'removed'
		 ORDER BY p.name, w.branch_name`,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to list all worktrees: %w", err)
	}
	defer rows.Close()

	var worktrees []*model.Worktree
	for rows.Next() {
		var wt model.Worktree
		if err := rows.Scan(&wt.ID, &wt.ProjectID, &wt.BranchName, &wt.WorktreePath, &wt.OpencodeSessionID,
			&wt.Status, &wt.CreatedAt, &wt.UpdatedAt, &wt.ProjectName); err != nil {
			return nil, fmt.Errorf("failed to scan worktree row: %w", err)
		}
		worktrees = append(worktrees, &wt)
	}
	return worktrees, rows.Err()
}

func (r *SQLiteWorktreeRepo) UpdateStatus(id int64, status string) error {
	_, err := r.DB.Exec(
		`UPDATE worktrees SET status = ?, updated_at = ? WHERE id = ?`,
		status, time.Now(), id,
	)
	if err != nil {
		return fmt.Errorf("failed to update worktree status: %w", err)
	}
	return nil
}

func (r *SQLiteWorktreeRepo) Delete(id int64) error {
	_, err := r.DB.Exec(`DELETE FROM worktrees WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("failed to delete worktree %d: %w", id, err)
	}
	return nil
}

func (r *SQLiteWorktreeRepo) BindSession(id int64, sessionID string) error {
	_, err := r.DB.Exec(
		`UPDATE worktrees SET opencode_session_id = ?, status = 'active', updated_at = ? WHERE id = ?`,
		sessionID, time.Now(), id,
	)
	if err != nil {
		return fmt.Errorf("failed to bind session to worktree %d: %w", id, err)
	}
	return nil
}

func (r *SQLiteWorktreeRepo) UnbindSession(id int64) error {
	_, err := r.DB.Exec(
		`UPDATE worktrees SET opencode_session_id = NULL, status = 'idle', updated_at = ? WHERE id = ?`,
		time.Now(), id,
	)
	if err != nil {
		return fmt.Errorf("failed to unbind session from worktree %d: %w", id, err)
	}
	return nil
}

func (r *SQLiteWorktreeRepo) GetBySessionID(sessionID string) (*model.Worktree, error) {
	var wt model.Worktree
	err := r.DB.QueryRow(
		`SELECT w.id, w.project_id, w.branch_name, w.worktree_path, w.opencode_session_id,
		        w.status, w.created_at, w.updated_at, p.name
		 FROM worktrees w JOIN projects p ON w.project_id = p.id
		 WHERE w.opencode_session_id = ?`, sessionID,
	).Scan(&wt.ID, &wt.ProjectID, &wt.BranchName, &wt.WorktreePath, &wt.OpencodeSessionID,
		&wt.Status, &wt.CreatedAt, &wt.UpdatedAt, &wt.ProjectName)
	if err != nil {
		return nil, fmt.Errorf("failed to get worktree by session ID %s: %w", sessionID, err)
	}
	return &wt, nil
}
