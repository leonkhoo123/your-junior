package opencode

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"

	"your-junior/internal/logger"
)

type Manager struct {
	cfg    *Config
	mu     sync.Mutex
	cmd    *exec.Cmd
	cancel context.CancelFunc
	done   chan struct{}
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

	m.done = make(chan struct{})
	done := m.done
	go func(cmd *exec.Cmd) {
		if err := cmd.Wait(); err != nil {
			logger.L.Warn("opencode server exited", "error", err)
		}
		close(done)
		m.mu.Lock()
		m.cmd = nil
		m.mu.Unlock()
	}(m.cmd)

	return m.waitForReady(ctx)
}

func (m *Manager) Stop() error {
	m.mu.Lock()

	if m.cmd == nil {
		m.mu.Unlock()
		return nil
	}

	logger.L.Info("stopping opencode server")

	if m.cancel != nil {
		m.cancel()
		m.cancel = nil
	}

	cmd := m.cmd
	m.cmd = nil
	done := m.done
	m.done = nil
	m.mu.Unlock()

	if cmd.Process != nil {
		if err := cmd.Process.Signal(os.Interrupt); err != nil {
			logger.L.Warn("failed to interrupt opencode, sending kill", "pid", cmd.Process.Pid)
			cmd.Process.Kill()
		}
	}

	if done != nil {
		select {
		case <-done:
			logger.L.Info("opencode server exited cleanly")
		case <-time.After(5 * time.Second):
			logger.L.Warn("opencode server did not exit gracefully, forcing kill")
			if cmd.Process != nil {
				cmd.Process.Kill()
			}
			<-done
		}
	}

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

func (m *Manager) SetModel(model string) {
	m.cfg.Model = model
	logger.L.Info("model updated", "model", model)
}

func (m *Manager) WriteProjectConfig(model string) error {
	l := logger.L.With("component", "opencode_manager", "method", "WriteProjectConfig")
	configPath := filepath.Join(m.cfg.WorkDir, "opencode.json")

	data, err := os.ReadFile(configPath)
	if err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to read existing opencode.json: %w", err)
	}

	var cfg map[string]any
	if len(data) > 0 {
		if err := json.Unmarshal(data, &cfg); err != nil {
			l.Warn("failed to parse existing opencode.json, overwriting", "error", err)
			cfg = make(map[string]any)
		}
	} else {
		cfg = make(map[string]any)
	}

	cfg["model"] = model

	jsonData, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal opencode.json: %w", err)
	}

	if err := os.WriteFile(configPath, jsonData, 0644); err != nil {
		return fmt.Errorf("failed to write opencode.json: %w", err)
	}

	l.Info("wrote opencode.json", "path", configPath, "model", model)
	return nil
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
