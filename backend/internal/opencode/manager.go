package opencode

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"sync"
	"time"

	"your-junior/internal/logger"
)

type Manager struct {
	cfg    *Config
	mu     sync.Mutex
	cmd    *exec.Cmd
	cancel context.CancelFunc
}

func NewManager(cfg *Config) *Manager {
	return &Manager{cfg: cfg}
}

func (m *Manager) Start() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.cmd != nil {
		return fmt.Errorf("opencode server already running")
	}

	if err := os.MkdirAll(m.cfg.WorkDir, 0755); err != nil {
		return fmt.Errorf("failed to create work directory %s: %w", m.cfg.WorkDir, err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	m.cancel = cancel

	args := []string{
		"serve",
		"--port", m.cfg.Port,
		"--hostname", m.cfg.Hostname,
		"--cors", m.cfg.CORSOrigin,
	}

	m.cmd = exec.CommandContext(ctx, "opencode", args...)
	m.cmd.Dir = m.cfg.WorkDir
	m.cmd.Stdout = os.Stdout
	m.cmd.Stderr = os.Stderr

	logger.L.Info("starting opencode server",
		"command", "opencode serve",
		"port", m.cfg.Port,
		"workdir", m.cfg.WorkDir,
	)

	if err := m.cmd.Start(); err != nil {
		m.cmd = nil
		m.cancel = nil
		return fmt.Errorf("failed to start opencode server: %w", err)
	}

	logger.L.Info("opencode server spawned", "pid", m.cmd.Process.Pid)

	go func() {
		if err := m.cmd.Wait(); err != nil {
			logger.L.Warn("opencode server exited", "error", err)
		}
		m.mu.Lock()
		m.cmd = nil
		m.mu.Unlock()
	}()

	return m.waitForReady(ctx)
}

func (m *Manager) Stop() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.cmd == nil {
		return nil
	}

	logger.L.Info("stopping opencode server")

	if m.cancel != nil {
		m.cancel()
		m.cancel = nil
	}

	if m.cmd.Process != nil {
		if err := m.cmd.Process.Signal(os.Interrupt); err != nil {
			logger.L.Warn("failed to interrupt opencode, sending kill", "pid", m.cmd.Process.Pid)
			m.cmd.Process.Kill()
		}
	}

	m.cmd = nil
	return nil
}

func (m *Manager) IsRunning() bool {
	m.mu.Lock()
	cmd := m.cmd
	m.mu.Unlock()

	if cmd == nil {
		return false
	}

	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get(m.cfg.HealthURL())
	if err != nil {
		return false
	}
	resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

func (m *Manager) GetBaseURL() string {
	return m.cfg.BaseURL()
}

func (m *Manager) GetModel() string {
	return m.cfg.Model
}

func (m *Manager) waitForReady(ctx context.Context) error {
	timeout := 10 * time.Second
	deadline := time.After(timeout)
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	client := &http.Client{Timeout: 2 * time.Second}

	for {
		select {
		case <-ctx.Done():
			return fmt.Errorf("context cancelled while waiting for opencode")
		case <-deadline:
			return fmt.Errorf("opencode server did not become ready within %v", timeout)
		case <-ticker.C:
			resp, err := client.Get(m.cfg.HealthURL())
			if err == nil {
				resp.Body.Close()
				if resp.StatusCode == http.StatusOK {
					logger.L.Info("opencode server is ready")
					return nil
				}
			}
		}
	}
}
