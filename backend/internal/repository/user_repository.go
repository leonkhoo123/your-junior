package repository

import (
	"database/sql"
	"time"

	"your-junior/internal/model"
)

type UserRepository interface {
	GetByUsername(username string) (*model.User, error)
	GetByID(id string) (*model.User, error)
	ListAll() ([]*model.User, error)
	Exists(username string) (bool, error)
	Create(user *model.User) error
	Delete(id string) error
	HasAdmin() (bool, error)
	CountAdmins() (int, error)
	UpdateMFASecret(username string, secret string) error
	EnableMFA(username string) error
	DisableMFA(username string) error
	IncrementTokenVersion(username string) error
	IncrementTokenVersionByID(id string) error
	IncrementFailedAttempts(username string, lockedUntil *time.Time) (int, error)
	ResetFailedAttempts(username string) error
	SaveRecoveryCodes(username string, hashedCodesJSON string) error
	GetRecoveryCodes(username string) (string, error)
	ConsumeRecoveryCode(username string, codeHash string) error
}

type SQLiteUserRepo struct {
	DB *sql.DB
}

func NewSQLiteUserRepo(db *sql.DB) *SQLiteUserRepo {
	return &SQLiteUserRepo{DB: db}
}

func (r *SQLiteUserRepo) GetByUsername(username string) (*model.User, error) {
	var u model.User
	err := r.DB.QueryRow(
		`SELECT id, username, password_hash, role, mfa_secret, mfa_enabled, mfa_mandatory, recovery_codes, created_at, updated_at, failed_attempts, locked_until, token_version 
		 FROM users WHERE username = ?`, username,
	).Scan(
		&u.ID, &u.Username, &u.PasswordHash, &u.Role, &u.MFASecret, &u.MFAEnabled, &u.MFAMandatory, &u.RecoveryCodes,
		&u.CreatedAt, &u.UpdatedAt, &u.FailedAttempts, &u.LockedUntil, &u.TokenVersion,
	)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *SQLiteUserRepo) GetByID(id string) (*model.User, error) {
	var u model.User
	err := r.DB.QueryRow(
		`SELECT id, username, password_hash, role, mfa_secret, mfa_enabled, mfa_mandatory, recovery_codes, created_at, updated_at, failed_attempts, locked_until, token_version 
		 FROM users WHERE id = ?`, id,
	).Scan(
		&u.ID, &u.Username, &u.PasswordHash, &u.Role, &u.MFASecret, &u.MFAEnabled, &u.MFAMandatory, &u.RecoveryCodes,
		&u.CreatedAt, &u.UpdatedAt, &u.FailedAttempts, &u.LockedUntil, &u.TokenVersion,
	)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *SQLiteUserRepo) ListAll() ([]*model.User, error) {
	rows, err := r.DB.Query(
		`SELECT id, username, password_hash, role, mfa_secret, mfa_enabled, mfa_mandatory, recovery_codes, created_at, updated_at, failed_attempts, locked_until, token_version 
		 FROM users ORDER BY created_at`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []*model.User
	for rows.Next() {
		var u model.User
		if err := rows.Scan(
			&u.ID, &u.Username, &u.PasswordHash, &u.Role, &u.MFASecret, &u.MFAEnabled, &u.MFAMandatory, &u.RecoveryCodes,
			&u.CreatedAt, &u.UpdatedAt, &u.FailedAttempts, &u.LockedUntil, &u.TokenVersion,
		); err != nil {
			return nil, err
		}
		users = append(users, &u)
	}
	return users, rows.Err()
}

func (r *SQLiteUserRepo) Exists(username string) (bool, error) {
	var exists bool
	err := r.DB.QueryRow(`SELECT EXISTS(SELECT 1 FROM users WHERE username = ?)`, username).Scan(&exists)
	return exists, err
}

func (r *SQLiteUserRepo) Create(user *model.User) error {
	_, err := r.DB.Exec(
		`INSERT INTO users (id, username, password_hash, role, mfa_mandatory) VALUES (?, ?, ?, ?, ?)`,
		user.ID, user.Username, user.PasswordHash, user.Role, user.MFAMandatory,
	)
	return err
}

func (r *SQLiteUserRepo) Delete(id string) error {
	_, err := r.DB.Exec(`DELETE FROM users WHERE id = ?`, id)
	return err
}

func (r *SQLiteUserRepo) HasAdmin() (bool, error) {
	var exists bool
	err := r.DB.QueryRow(`SELECT EXISTS(SELECT 1 FROM users WHERE role = 'admin')`).Scan(&exists)
	return exists, err
}

func (r *SQLiteUserRepo) CountAdmins() (int, error) {
	var count int
	err := r.DB.QueryRow(`SELECT COUNT(*) FROM users WHERE role = 'admin'`).Scan(&count)
	return count, err
}

func (r *SQLiteUserRepo) UpdateMFASecret(username string, secret string) error {
	_, err := r.DB.Exec("UPDATE users SET mfa_secret = ? WHERE username = ?", secret, username)
	return err
}

func (r *SQLiteUserRepo) EnableMFA(username string) error {
	_, err := r.DB.Exec("UPDATE users SET mfa_enabled = 1 WHERE username = ?", username)
	return err
}

func (r *SQLiteUserRepo) IncrementTokenVersion(username string) error {
	_, err := r.DB.Exec(`UPDATE users SET token_version = token_version + 1 WHERE username = ?`, username)
	return err
}

func (r *SQLiteUserRepo) IncrementTokenVersionByID(id string) error {
	_, err := r.DB.Exec(`UPDATE users SET token_version = token_version + 1 WHERE id = ?`, id)
	return err
}

func (r *SQLiteUserRepo) IncrementFailedAttempts(username string, lockedUntil *time.Time) (int, error) {
	_, err := r.DB.Exec(
		`UPDATE users SET failed_attempts = failed_attempts + 1, locked_until = ? WHERE username = ?`,
		lockedUntil, username,
	)
	if err != nil {
		return 0, err
	}
	var count int
	err = r.DB.QueryRow(`SELECT failed_attempts FROM users WHERE username = ?`, username).Scan(&count)
	return count, err
}

func (r *SQLiteUserRepo) ResetFailedAttempts(username string) error {
	_, err := r.DB.Exec(`UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE username = ?`, username)
	return err
}

func (r *SQLiteUserRepo) SaveRecoveryCodes(username string, hashedCodesJSON string) error {
	_, err := r.DB.Exec(`UPDATE users SET recovery_codes = ? WHERE username = ?`, hashedCodesJSON, username)
	return err
}

func (r *SQLiteUserRepo) GetRecoveryCodes(username string) (string, error) {
	var codes sql.NullString
	err := r.DB.QueryRow(`SELECT recovery_codes FROM users WHERE username = ?`, username).Scan(&codes)
	if err != nil {
		return "", err
	}
	if codes.Valid {
		return codes.String, nil
	}
	return "", nil
}

func (r *SQLiteUserRepo) ConsumeRecoveryCode(username string, codeHash string) error {
	var idx sql.NullInt64
	err := r.DB.QueryRow(
		`SELECT key FROM json_each((SELECT recovery_codes FROM users WHERE username = ?)) WHERE value = ?`,
		username, codeHash,
	).Scan(&idx)
	if err != nil {
		return err
	}
	if !idx.Valid {
		return sql.ErrNoRows
	}
	_, err = r.DB.Exec(
		`UPDATE users SET recovery_codes = json_remove(recovery_codes, '$[' || ? || ']') WHERE username = ?`,
		idx.Int64, username,
	)
	return err
}

func (r *SQLiteUserRepo) DisableMFA(username string) error {
	_, err := r.DB.Exec(`UPDATE users SET mfa_enabled = 0, mfa_secret = NULL, recovery_codes = NULL WHERE username = ?`, username)
	return err
}
