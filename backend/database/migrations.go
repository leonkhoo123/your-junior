package database

import (
	"database/sql"
	"embed"
	"fmt"
	"sort"
	"strings"

	"your-junior/internal/logger"
)

//go:embed migrations/*.sql
var embeddedMigrations embed.FS

func RunMigrations(db *sql.DB) error {
	_, err := db.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
		version TEXT PRIMARY KEY,
		applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
	)`)
	if err != nil {
		return fmt.Errorf("failed to create schema_migrations table: %w", err)
	}

	rows, err := db.Query("SELECT version FROM schema_migrations")
	if err != nil {
		return fmt.Errorf("failed to list applied migrations: %w", err)
	}
	defer rows.Close()

	applied := make(map[string]bool)
	for rows.Next() {
		var version string
		if err := rows.Scan(&version); err != nil {
			return fmt.Errorf("failed to read migration version: %w", err)
		}
		applied[version] = true
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("failed to iterate migration versions: %w", err)
	}

	entries, err := embeddedMigrations.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf("failed to read embedded migrations directory: %w", err)
	}

	var toApply []string
	for _, f := range entries {
		if !f.IsDir() && strings.HasSuffix(f.Name(), ".sql") {
			if !applied[f.Name()] {
				toApply = append(toApply, f.Name())
			}
		}
	}

	sort.Strings(toApply)

	if len(toApply) == 0 {
		logger.L.Info("no new migrations to apply")
		return nil
	}

	for _, file := range toApply {
		logger.L.Info("applying migration", "file", file)
		content, err := embeddedMigrations.ReadFile("migrations/" + file)
		if err != nil {
			return fmt.Errorf("failed to read migration file %s: %w", file, err)
		}

		tx, err := db.Begin()
		if err != nil {
			return fmt.Errorf("failed to begin transaction for %s: %w", file, err)
		}

		_, err = tx.Exec(string(content))
		if err != nil {
			tx.Rollback()
			return fmt.Errorf("failed to execute migration %s: %w", file, err)
		}

		_, err = tx.Exec("INSERT INTO schema_migrations (version) VALUES (?)", file)
		if err != nil {
			tx.Rollback()
			return fmt.Errorf("failed to record migration %s: %w", file, err)
		}

		if err := tx.Commit(); err != nil {
			return fmt.Errorf("failed to commit migration %s: %w", file, err)
		}
		logger.L.Info("migration applied successfully", "file", file)
	}

	return nil
}
