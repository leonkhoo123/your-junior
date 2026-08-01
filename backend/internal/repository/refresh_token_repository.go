package repository

import (
	"database/sql"

	"your-junior/internal/model"
)

type RefreshTokenRepository interface {
	Create(rt *model.RefreshToken) error
	GetByTokenHash(hash string) (*model.RefreshToken, error)
	GetActiveSessions(username string) ([]model.RefreshToken, error)
	CountActiveSessions(username string) (int, error)
	RevokeByID(id string) error
	RevokeByFamilyID(familyID string) error
	RevokeByUsername(username string) error
	RevokeByUsernameAndFamilyID(username string, familyID string) (int64, error)
	DeleteExpired() (int64, error)
	RotateTx(oldID string, newToken *model.RefreshToken) error
}

type SQLiteRefreshTokenRepo struct {
	DB *sql.DB
}

func NewSQLiteRefreshTokenRepo(db *sql.DB) *SQLiteRefreshTokenRepo {
	return &SQLiteRefreshTokenRepo{DB: db}
}

func (r *SQLiteRefreshTokenRepo) Create(rt *model.RefreshToken) error {
	_, err := r.DB.Exec(`
		INSERT INTO refresh_tokens (id, username, token_hash, family_id, device_id, device_info, ip_address, expires_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, rt.ID, rt.Username, rt.TokenHash, rt.FamilyID, rt.DeviceID, rt.DeviceInfo, rt.IPAddress, rt.ExpiresAt)
	return err
}

func (r *SQLiteRefreshTokenRepo) GetByTokenHash(hash string) (*model.RefreshToken, error) {
	var rt model.RefreshToken
	err := r.DB.QueryRow(`
		SELECT id, username, family_id, device_id, device_info, ip_address, expires_at, is_revoked 
		FROM refresh_tokens WHERE token_hash = ?
	`, hash).Scan(&rt.ID, &rt.Username, &rt.FamilyID, &rt.DeviceID, &rt.DeviceInfo, &rt.IPAddress, &rt.ExpiresAt, &rt.IsRevoked)
	if err != nil {
		return nil, err
	}
	rt.TokenHash = hash
	return &rt, nil
}

func (r *SQLiteRefreshTokenRepo) GetActiveSessions(username string) ([]model.RefreshToken, error) {
	rows, err := r.DB.Query(`
		SELECT family_id, device_id, device_info, ip_address, created_at, expires_at
		FROM refresh_tokens
		WHERE username = ? AND is_revoked = 0 AND expires_at > CURRENT_TIMESTAMP
		GROUP BY family_id
		ORDER BY MAX(created_at) DESC
	`, username)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []model.RefreshToken
	for rows.Next() {
		var rt model.RefreshToken
		if err := rows.Scan(&rt.FamilyID, &rt.DeviceID, &rt.DeviceInfo, &rt.IPAddress, &rt.CreatedAt, &rt.ExpiresAt); err != nil {
			return nil, err
		}
		sessions = append(sessions, rt)
	}
	return sessions, nil
}

func (r *SQLiteRefreshTokenRepo) CountActiveSessions(username string) (int, error) {
	var count int
	err := r.DB.QueryRow(`
		SELECT COUNT(DISTINCT family_id)
		FROM refresh_tokens
		WHERE username = ? AND is_revoked = 0 AND expires_at > CURRENT_TIMESTAMP
	`, username).Scan(&count)
	return count, err
}

func (r *SQLiteRefreshTokenRepo) RevokeByID(id string) error {
	_, err := r.DB.Exec("UPDATE refresh_tokens SET is_revoked = 1 WHERE id = ?", id)
	return err
}

func (r *SQLiteRefreshTokenRepo) RevokeByFamilyID(familyID string) error {
	_, err := r.DB.Exec("UPDATE refresh_tokens SET is_revoked = 1 WHERE family_id = ?", familyID)
	return err
}

func (r *SQLiteRefreshTokenRepo) RevokeByUsername(username string) error {
	_, err := r.DB.Exec("UPDATE refresh_tokens SET is_revoked = 1 WHERE username = ?", username)
	return err
}

func (r *SQLiteRefreshTokenRepo) RevokeByUsernameAndFamilyID(username string, familyID string) (int64, error) {
	result, err := r.DB.Exec("UPDATE refresh_tokens SET is_revoked = 1 WHERE username = ? AND family_id = ?", username, familyID)
	if err != nil {
		return 0, err
	}
	rowsAffected, err := result.RowsAffected()
	return rowsAffected, err
}

func (r *SQLiteRefreshTokenRepo) DeleteExpired() (int64, error) {
	result, err := r.DB.Exec("DELETE FROM refresh_tokens WHERE is_revoked = 1 OR expires_at <= CURRENT_TIMESTAMP")
	if err != nil {
		return 0, err
	}
	rowsAffected, err := result.RowsAffected()
	return rowsAffected, err
}

func (r *SQLiteRefreshTokenRepo) RotateTx(oldID string, newToken *model.RefreshToken) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.Exec("UPDATE refresh_tokens SET is_revoked = 1 WHERE id = ?", oldID)
	if err != nil {
		return err
	}

	_, err = tx.Exec(`
		INSERT INTO refresh_tokens (id, username, token_hash, family_id, device_id, device_info, ip_address, expires_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, newToken.ID, newToken.Username, newToken.TokenHash, newToken.FamilyID, newToken.DeviceID, newToken.DeviceInfo, newToken.IPAddress, newToken.ExpiresAt)
	if err != nil {
		return err
	}

	return tx.Commit()
}
