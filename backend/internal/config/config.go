package config

import (
	"fmt"
	"os"
	"strings"

	"your-junior/internal/logger"

	"github.com/joho/godotenv"
)

type ServerConfig struct {
	AppEnv         string
	ListenAddr     string
	AllowedOrigins []string
	LogLevel       string
}

type AuthConfig struct {
	AppJwt string

	SecureMode                 bool
	AllowUnsafeUnprotectedMode bool
	TrustedProxyCIDRs          []string
}

type AppDefaults struct {
	ServiceName string
}

type CloudConfig struct {
	Server   ServerConfig
	Auth     AuthConfig
	Defaults AppDefaults
}

var AppConfig *CloudConfig

func Load() *CloudConfig {
	envPath := resolveEnvPath()
	if err := godotenv.Load(envPath); err != nil {
		logger.L.Warn("failed to load .env file, using built-in defaults",
			"path", envPath,
			"error", err.Error(),
		)
	} else {
		logger.L.Debug("loaded .env file", "path", envPath)
	}
	checkEnvPermissions(envPath)

	allowedOriginsStr := getEnv("ALLOWED_ORIGINS", "http://localhost:5173")
	var origins []string
	for _, o := range strings.Split(allowedOriginsStr, ",") {
		if trimmed := strings.TrimSpace(o); trimmed != "" {
			origins = append(origins, trimmed)
		}
	}

	appEnv := getEnv("APP_ENV", "prod")

	// Validate ALLOWED_ORIGINS: no wildcards with credentials (CORS security)
	for _, origin := range origins {
		if origin == "*" || origin == "null" {
			logger.L.Fatal("ALLOWED_ORIGINS contains wildcard '*' or 'null' — this bypasses CORS with AllowCredentials; "+
				"list explicit origins instead",
				"origin", origin,
			)
		}
	}

	c := &CloudConfig{
		Server: ServerConfig{
			AppEnv:         appEnv,
			ListenAddr:     getEnv("LISTEN_ADDR", ":8080"),
			AllowedOrigins: origins,
			LogLevel:       getEnv("LOG_LEVEL", "info"),
		},
		Auth: AuthConfig{
			AppJwt:                     getEnv("APP_JWT", ""),
			SecureMode:                 getSecureMode(appEnv),
			AllowUnsafeUnprotectedMode: strings.EqualFold(getEnv("ALLOW_UNSAFE_UNPROTECTED_MODE", ""), "true"),
			TrustedProxyCIDRs:          parseCIDRList(getEnv("TRUSTED_PROXY_CIDRS", "")),
		},
		Defaults: AppDefaults{
			ServiceName: getEnv("DEFAULT_SERVICE_NAME", "Your Junior"),
		},
	}
	AppConfig = c

	logger.L.Info("starting application",
		"listen_addr", c.Server.ListenAddr,
		"log_level", c.Server.LogLevel,
		"app_env", c.Server.AppEnv,
		"secure_mode", c.Auth.SecureMode,
	)

	return c
}

func resolveEnvPath() string {
	for _, p := range []string{"../.env", "../../.env", ".env"} {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return ".env"
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getSecureMode(appEnv string) bool {
	if v := os.Getenv("SECURE_MODE"); v != "" {
		return strings.EqualFold(v, "true") || v == "1"
	}
	if appEnv == "dev" {
		logger.L.Warn("SecureMode disabled for dev environment — do not use in production")
		return false
	}
	return true
}

func parseCIDRList(raw string) []string {
	if raw == "" {
		return nil
	}
	var out []string
	for _, s := range strings.Split(raw, ",") {
		if trimmed := strings.TrimSpace(s); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}

func checkEnvPermissions(envPath string) {
	info, err := os.Stat(envPath)
	if err != nil {
		return
	}
	perm := info.Mode().Perm()
	if perm&0077 != 0 {
		logger.L.Warn(".env file is readable by group/others — restricting to owner-only (0600)",
			"path", envPath,
			"current_perm", fmt.Sprintf("%04o", perm),
		)
		if err := os.Chmod(envPath, 0600); err != nil {
			logger.L.Warn("failed to restrict .env permissions — set manually: chmod 600 .env",
				"error", err.Error(),
			)
		}
	}
}
