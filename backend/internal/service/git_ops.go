package service

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"your-junior/internal/logger"
)

func BareClone(gitURL, barePath string) error {
	if err := os.MkdirAll(filepath.Dir(barePath), 0755); err != nil {
		return fmt.Errorf("failed to create parent directory for bare clone: %w", err)
	}

	l := logger.L.With("component", "git_ops", "method", "BareClone")
	l.Info("cloning bare repository", "url", gitURL, "path", barePath)

	cmd := exec.Command("git", "clone", "--bare", gitURL, barePath)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git clone --bare failed: %s: %w", string(output), err)
	}
	l.Info("bare clone complete", "path", barePath)
	return nil
}

func FetchBranches(barePath string) ([]string, error) {
	l := logger.L.With("component", "git_ops", "method", "FetchBranches")
	l.Info("fetching remote branches", "bare_path", barePath)

	cmd := exec.Command("git", "fetch", "--all", "--prune")
	cmd.Dir = barePath
	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("git fetch failed: %s: %w", string(output), err)
	}

	cmd = exec.Command("git", "branch", "-r")
	cmd.Dir = barePath
	output, err = cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("git branch -r failed: %w", err)
	}

	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	branches := make([]string, 0, len(lines))
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		branch := strings.TrimPrefix(line, "origin/")
		if branch == "HEAD" || branch == "HEAD -> origin" || strings.Contains(branch, " -> ") {
			continue
		}
		branches = append(branches, branch)
	}

	l.Info("branches fetched", "count", len(branches))
	return branches, nil
}

func AddWorktree(barePath, worktreePath, branchName string) error {
	if err := os.MkdirAll(filepath.Dir(worktreePath), 0755); err != nil {
		return fmt.Errorf("failed to create parent directory for worktree: %w", err)
	}

	l := logger.L.With("component", "git_ops", "method", "AddWorktree")
	l.Info("adding worktree", "bare", barePath, "path", worktreePath, "branch", branchName)

	cmd := exec.Command("git", "worktree", "add", worktreePath, "origin/"+branchName)
	cmd.Dir = barePath
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git worktree add failed: %s: %w", string(output), err)
	}
	l.Info("worktree created", "path", worktreePath)
	return nil
}

func PruneWorktree(worktreePath, barePath string) error {
	l := logger.L.With("component", "git_ops", "method", "PruneWorktree")
	l.Info("pruning worktree", "path", worktreePath)

	cmd := exec.Command("git", "worktree", "prune")
	cmd.Dir = barePath
	output, err := cmd.CombinedOutput()
	if err != nil {
		l.Warn("git worktree prune failed", "output", string(output), "error", err)
	}

	if err := os.RemoveAll(worktreePath); err != nil {
		return fmt.Errorf("failed to remove worktree directory %s: %w", worktreePath, err)
	}
	l.Info("worktree pruned", "path", worktreePath)
	return nil
}
