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

	cmd = exec.Command("git", "branch")
	cmd.Dir = barePath
	output, err = cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("git branch failed: %w", err)
	}

	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	branches := make([]string, 0, len(lines))
	for _, line := range lines {
		line = strings.TrimSpace(line)
		line = strings.TrimPrefix(line, "* ")
		if line == "" {
			continue
		}
		branches = append(branches, line)
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

	cmd := exec.Command("git", "worktree", "add", worktreePath, branchName)
	cmd.Dir = barePath
	output, err := cmd.CombinedOutput()
	if err != nil {
		if strings.Contains(string(output), "invalid reference") {
			l.Info("branch does not exist, creating new branch", "branch", branchName)
			cmd = exec.Command("git", "worktree", "add", "-b", branchName, worktreePath)
			cmd.Dir = barePath
			output, err = cmd.CombinedOutput()
			if err != nil {
				return fmt.Errorf("git worktree add -b failed: %s: %w", string(output), err)
			}
			l.Info("worktree created with new branch", "path", worktreePath)
			return nil
		}
		return fmt.Errorf("git worktree add failed: %s: %w", string(output), err)
	}
	l.Info("worktree created", "path", worktreePath)
	return nil
}

func DeleteBranch(barePath, branchName string) error {
	l := logger.L.With("component", "git_ops", "method", "DeleteBranch")
	l.Info("deleting branch", "bare", barePath, "branch", branchName)

	cmd := exec.Command("git", "branch", "-D", branchName)
	cmd.Dir = barePath
	output, err := cmd.CombinedOutput()
	if err != nil {
		l.Warn("git branch -D failed", "output", string(output), "error", err)
	} else {
		l.Info("local branch deleted", "branch", branchName)
	}

	cmd = exec.Command("git", "push", "origin", "--delete", branchName)
	cmd.Dir = barePath
	output, err = cmd.CombinedOutput()
	if err != nil {
		l.Warn("git push --delete failed", "output", string(output), "error", err)
		return fmt.Errorf("delete remote branch %s failed: %s: %w", branchName, string(output), err)
	}

	l.Info("remote branch deleted", "branch", branchName)
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
