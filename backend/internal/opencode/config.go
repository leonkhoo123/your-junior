package opencode

import (
	"os"
	"path/filepath"
)

type Config struct {
	Port       string
	Hostname   string
	Model      string
	WorkDir    string
	CORSOrigin string
}

func DefaultConfig() *Config {
	return &Config{
		Port:       getEnv("OPENCODE_PORT", "4096"),
		Hostname:   getEnv("OPENCODE_HOSTNAME", "127.0.0.1"),
		Model:      getEnv("OPENCODE_MODEL", "deepseek/deepseek-v4-pro"),
		WorkDir:    getEnv("OPENCODE_WORKDIR", filepath.Join("..", "project")),
		CORSOrigin: getEnv("OPENCODE_CORS_ORIGIN", "http://localhost:5173"),
	}
}

func (c *Config) BaseURL() string {
	return "http://" + c.Hostname + ":" + c.Port
}

func (c *Config) HealthURL() string {
	return c.BaseURL() + "/global/health"
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
