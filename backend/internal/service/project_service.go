package service

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"your-junior/internal/logger"
	"your-junior/internal/model"
	"your-junior/internal/repository"
)

type ProjectService struct {
	repo        repository.ProjectRepository
	wtRepo      repository.WorktreeRepository
	projectsDir string
}

func NewProjectService(repo repository.ProjectRepository, wtRepo repository.WorktreeRepository, projectsDir string) *ProjectService {
	return &ProjectService{repo: repo, wtRepo: wtRepo, projectsDir: projectsDir}
}

func (s *ProjectService) AddProject(gitURL string) (*model.Project, error) {
	name, err := extractRepoName(gitURL)
	if err != nil {
		return nil, fmt.Errorf("invalid git URL: %w", err)
	}

	barePath := filepath.Join(s.projectsDir, name+".git")

	project := &model.Project{
		Name:     name,
		GitURL:   gitURL,
		BarePath: barePath,
		Status:   "cloning",
	}

	if err := s.repo.Create(project); err != nil {
		return nil, fmt.Errorf("failed to create project record: %w", err)
	}

	if err := BareClone(gitURL, barePath); err != nil {
		s.repo.UpdateStatus(project.ID, "error")
		return nil, fmt.Errorf("failed to clone bare repo: %w", err)
	}

	s.repo.UpdateStatus(project.ID, "active")
	project.Status = "active"

	logger.L.Info("project added", "name", name, "id", project.ID)
	return project, nil
}

func (s *ProjectService) ListProjects() ([]*model.Project, error) {
	return s.repo.ListAll()
}

func (s *ProjectService) RemoveProject(id int64) error {
	project, err := s.repo.GetByID(id)
	if err != nil {
		return fmt.Errorf("project not found: %w", err)
	}

	worktrees, _ := s.wtRepo.ListByProject(id)
	for _, wt := range worktrees {
		PruneWorktree(wt.WorktreePath, project.BarePath)
	}

	if err := os.RemoveAll(project.BarePath); err != nil {
		logger.L.Warn("failed to remove bare repo directory", "path", project.BarePath, "error", err)
	}

	if err := s.repo.Delete(id); err != nil {
		return fmt.Errorf("failed to delete project record: %w", err)
	}

	logger.L.Info("project removed", "id", id, "name", project.Name)
	return nil
}

func (s *ProjectService) FetchBranches(projectID int64) ([]string, error) {
	project, err := s.repo.GetByID(projectID)
	if err != nil {
		return nil, fmt.Errorf("project not found: %w", err)
	}
	return FetchBranches(project.BarePath)
}

func extractRepoName(gitURL string) (string, error) {
	clean := strings.TrimSpace(gitURL)
	clean = strings.TrimSuffix(clean, "/")
	clean = strings.TrimSuffix(clean, ".git")

	parts := strings.Split(clean, "/")
	if len(parts) == 0 {
		return "", fmt.Errorf("cannot extract repo name from URL: %s", gitURL)
	}

	name := parts[len(parts)-1]
	if strings.HasSuffix(name, ":") {
		name = strings.TrimSuffix(name, ":")
		parts := strings.Split(gitURL, "/")
		if len(parts) > 0 {
			last := parts[len(parts)-1]
			name = strings.TrimSuffix(last, ".git")
		}
	}

	if name == "" {
		return "", fmt.Errorf("cannot extract repo name from URL: %s", gitURL)
	}

	return name, nil
}
