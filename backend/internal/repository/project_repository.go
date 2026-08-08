package repository

import (
	"database/sql"
	"fmt"
	"time"

	"your-junior/internal/model"
)

type ProjectRepository interface {
	Create(project *model.Project) error
	GetByID(id int64) (*model.Project, error)
	ListAll() ([]*model.Project, error)
	UpdateStatus(id int64, status string) error
	Delete(id int64) error
}

type SQLiteProjectRepo struct {
	DB *sql.DB
}

func NewSQLiteProjectRepo(db *sql.DB) *SQLiteProjectRepo {
	return &SQLiteProjectRepo{DB: db}
}

func (r *SQLiteProjectRepo) Create(project *model.Project) error {
	result, err := r.DB.Exec(
		`INSERT INTO projects (name, git_url, bare_path, status) VALUES (?, ?, ?, ?)`,
		project.Name, project.GitURL, project.BarePath, project.Status,
	)
	if err != nil {
		return fmt.Errorf("failed to create project: %w", err)
	}
	id, err := result.LastInsertId()
	if err != nil {
		return fmt.Errorf("failed to get project ID: %w", err)
	}
	project.ID = id
	return nil
}

func (r *SQLiteProjectRepo) GetByID(id int64) (*model.Project, error) {
	var p model.Project
	err := r.DB.QueryRow(
		`SELECT id, name, git_url, bare_path, status, created_at, updated_at FROM projects WHERE id = ?`, id,
	).Scan(&p.ID, &p.Name, &p.GitURL, &p.BarePath, &p.Status, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to get project by ID %d: %w", id, err)
	}
	return &p, nil
}

func (r *SQLiteProjectRepo) ListAll() ([]*model.Project, error) {
	rows, err := r.DB.Query(
		`SELECT id, name, git_url, bare_path, status, created_at, updated_at FROM projects WHERE status != 'archived' ORDER BY created_at DESC`,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to list projects: %w", err)
	}
	defer rows.Close()

	var projects []*model.Project
	for rows.Next() {
		var p model.Project
		if err := rows.Scan(&p.ID, &p.Name, &p.GitURL, &p.BarePath, &p.Status, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan project row: %w", err)
		}
		projects = append(projects, &p)
	}
	return projects, rows.Err()
}

func (r *SQLiteProjectRepo) UpdateStatus(id int64, status string) error {
	_, err := r.DB.Exec(
		`UPDATE projects SET status = ?, updated_at = ? WHERE id = ?`,
		status, time.Now(), id,
	)
	if err != nil {
		return fmt.Errorf("failed to update project status: %w", err)
	}
	return nil
}

func (r *SQLiteProjectRepo) Delete(id int64) error {
	_, err := r.DB.Exec(`DELETE FROM projects WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("failed to delete project %d: %w", id, err)
	}
	return nil
}
