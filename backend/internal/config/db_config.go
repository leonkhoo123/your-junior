package config

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"os"
	"strconv"

	"your-junior/database"
	"your-junior/internal/logger"

	"github.com/leonkhoo123/gonet-auth/audit"
	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

// SQLiteSecretStore implements gonetauth.SecretStore backed by SQLite.
type SQLiteSecretStore struct {
	DB *sql.DB
}

func (s *SQLiteSecretStore) LoadSecret(key string) (string, error) {
	var value string
	err := s.DB.QueryRow("SELECT value FROM app_settings WHERE key = ?", key).Scan(&value)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", os.ErrNotExist
		}
		return "", err
	}
	return value, nil
}

func (s *SQLiteSecretStore) SaveSecret(key, value string) error {
	_, err := s.DB.Exec(
		"INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)",
		key, value,
	)
	return err
}

// SQLiteAuditLogStore implements audit.AuditLogStore backed by SQLite.
type SQLiteAuditLogStore struct {
	DB *sql.DB
}

func (s *SQLiteAuditLogStore) Log(ctx context.Context, event audit.AuditEvent) error {
	metadataJSON, err := json.Marshal(event.Metadata)
	if err != nil {
		metadataJSON = []byte("{}")
	}
	_, err = s.DB.ExecContext(ctx,
		"INSERT INTO audit_logs (event_type, username, ip, device_info, family_id, metadata, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
		string(event.Type), event.Username, event.IP, event.DeviceInfo, event.FamilyID, string(metadataJSON), event.Timestamp,
	)
	return err
}

func (s *SQLiteAuditLogStore) DeleteExpired(ctx context.Context, retentionDays int) (int64, error) {
	if retentionDays <= 0 {
		return 0, nil
	}
	result, err := s.DB.ExecContext(ctx,
		"DELETE FROM audit_logs WHERE timestamp < datetime('now', '-' || ? || ' days')",
		strconv.Itoa(retentionDays),
	)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

func InitDB() {
	configDir := resolveDBDir()

	if _, err := os.Stat(configDir); os.IsNotExist(err) {
		err = os.MkdirAll(configDir, 0700)
		if err != nil {
			logger.L.Fatal("failed to create DB directory", "path", configDir, "err", err)
		}
	} else if err == nil {
		if info, statErr := os.Stat(configDir); statErr == nil {
			if info.Mode().Perm() != 0700 {
				os.Chmod(configDir, 0700)
			}
		}
	}

	dbPath := configDir + "/config.db?_busy_timeout=5000"

	var err error
	DB, err = sql.Open("sqlite3", dbPath)
	if err != nil {
		logger.L.Fatal("failed to connect to database", "err", err)
	}

	_, err = DB.Exec("PRAGMA journal_mode=WAL")
	if err != nil {
		logger.L.Fatal("failed to enable WAL mode", "err", err)
	}

	if err := database.RunMigrations(DB); err != nil {
		logger.L.Fatal("database migrations failed", "err", err)
	}
}

func resolveDBDir() string {
	return "../db"
}
