package service

import (
	"fmt"
	"path/filepath"

	"your-junior/internal/logger"
	"your-junior/internal/model"
	"your-junior/internal/repository"
)

type WorktreeService struct {
	repo        repository.WorktreeRepository
	projectRepo repository.ProjectRepository
	projectsDir string
}

func NewWorktreeService(repo repository.WorktreeRepository, projectRepo repository.ProjectRepository, projectsDir string) *WorktreeService {
	return &WorktreeService{repo: repo, projectRepo: projectRepo, projectsDir: projectsDir}
}

func (s *WorktreeService) CreateWorktree(projectID int64, branchName string) (*model.Worktree, error) {
	project, err := s.projectRepo.GetByID(projectID)
	if err != nil {
		return nil, fmt.Errorf("project not found: %w", err)
	}

	worktreeDir := filepath.Join(s.projectsDir, project.Name, branchName)

	wt := &model.Worktree{
		ProjectID:    projectID,
		BranchName:   branchName,
		WorktreePath: worktreeDir,
		Status:       "creating",
	}

	if err := s.repo.Create(wt); err != nil {
		return nil, fmt.Errorf("failed to create worktree record: %w", err)
	}

	if err := AddWorktree(project.BarePath, worktreeDir, branchName); err != nil {
		s.repo.UpdateStatus(wt.ID, "error")
		return nil, fmt.Errorf("failed to create git worktree: %w", err)
	}

	s.repo.UpdateStatus(wt.ID, "idle")
	wt.Status = "idle"

	logger.L.Info("worktree created", "id", wt.ID, "branch", branchName, "project", project.Name)
	return wt, nil
}

func (s *WorktreeService) ListWorktrees(projectID int64) ([]*model.Worktree, error) {
	if projectID == 0 {
		return s.repo.ListAllWithProjectName()
	}
	return s.repo.ListByProject(projectID)
}

func (s *WorktreeService) RemoveWorktree(id int64) error {
	wt, err := s.repo.GetByID(id)
	if err != nil {
		return fmt.Errorf("worktree not found: %w", err)
	}

	project, err := s.projectRepo.GetByID(wt.ProjectID)
	if err != nil {
		return fmt.Errorf("project not found: %w", err)
	}

	if err := DeleteBranch(project.BarePath, wt.BranchName); err != nil {
		logger.L.Warn("failed to delete git branch", "branch", wt.BranchName, "error", err)
	}

	if err := PruneWorktree(wt.WorktreePath, project.BarePath); err != nil {
		logger.L.Warn("failed to prune worktree directory", "path", wt.WorktreePath, "error", err)
	}

	if err := s.repo.Delete(id); err != nil {
		return fmt.Errorf("failed to delete worktree record: %w", err)
	}

	logger.L.Info("worktree removed", "id", id, "branch", wt.BranchName)
	return nil
}

func (s *WorktreeService) BindSession(worktreeID int64, sessionID string) error {
	return s.repo.BindSession(worktreeID, sessionID)
}

func (s *WorktreeService) UnbindSession(worktreeID int64) error {
	return s.repo.UnbindSession(worktreeID)
}

func (s *WorktreeService) GetBySessionID(sessionID string) (*model.Worktree, error) {
	return s.repo.GetBySessionID(sessionID)
}

func (s *WorktreeService) GetWorktree(id int64) (*model.Worktree, error) {
	return s.repo.GetByID(id)
}
