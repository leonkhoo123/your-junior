package auth

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	gonetauth "github.com/leonkhoo123/gonet-auth"

	"your-junior/internal/model"
	"your-junior/internal/repository"
)

type SQLiteUserStore struct {
	Repo repository.UserRepository
}

func (s *SQLiteUserStore) GetByUsername(_ context.Context, username string) (*gonetauth.User, error) {
	u, err := s.Repo.GetByUsername(username)
	if err != nil {
		return nil, err
	}
	return toGonetUser(u), nil
}

func (s *SQLiteUserStore) GetByID(_ context.Context, id string) (*gonetauth.User, error) {
	u, err := s.Repo.GetByID(id)
	if err != nil {
		return nil, err
	}
	return toGonetUser(u), nil
}

func (s *SQLiteUserStore) Exists(_ context.Context, username string) (bool, error) {
	return s.Repo.Exists(username)
}

func (s *SQLiteUserStore) Create(_ context.Context, user *gonetauth.User) error {
	return s.Repo.Create(&model.User{
		ID:           user.ID,
		Username:     user.Username,
		PasswordHash: user.PasswordHash,
		Role:         user.Role,
		MFAMandatory: user.MFAMandatory,
	})
}

func (s *SQLiteUserStore) HasAdmin(_ context.Context) (bool, error) {
	return s.Repo.HasAdmin()
}

func (s *SQLiteUserStore) CountAdmins(_ context.Context) (int, error) {
	return s.Repo.CountAdmins()
}

func (s *SQLiteUserStore) Delete(_ context.Context, id string) error {
	return s.Repo.Delete(id)
}

func (s *SQLiteUserStore) ListUsers(_ context.Context) ([]gonetauth.User, error) {
	users, err := s.Repo.ListAll()
	if err != nil {
		return nil, err
	}
	result := make([]gonetauth.User, 0, len(users))
	for _, u := range users {
		result = append(result, *toGonetUser(u))
	}
	return result, nil
}

func (s *SQLiteUserStore) UpdateMFASecret(_ context.Context, username, secret string) error {
	return s.Repo.UpdateMFASecret(username, secret)
}

func (s *SQLiteUserStore) EnableMFA(_ context.Context, username string) error {
	return s.Repo.EnableMFA(username)
}

func (s *SQLiteUserStore) DisableMFA(_ context.Context, username string) error {
	return s.Repo.DisableMFA(username)
}

func (s *SQLiteUserStore) IncrementTokenVersion(_ context.Context, username string) error {
	return s.Repo.IncrementTokenVersion(username)
}

func (s *SQLiteUserStore) IncrementTokenVersionByID(_ context.Context, id string) error {
	return s.Repo.IncrementTokenVersionByID(id)
}

func (s *SQLiteUserStore) IncrementFailedAttempts(_ context.Context, username string, lockedUntil *time.Time) (int, error) {
	return s.Repo.IncrementFailedAttempts(username, lockedUntil)
}

func (s *SQLiteUserStore) ResetFailedAttempts(_ context.Context, username string) error {
	return s.Repo.ResetFailedAttempts(username)
}

func (s *SQLiteUserStore) SaveRecoveryCodes(_ context.Context, username string, hashedCodes []string) error {
	encoded, err := json.Marshal(hashedCodes)
	if err != nil {
		return err
	}
	return s.Repo.SaveRecoveryCodes(username, string(encoded))
}

func (s *SQLiteUserStore) GetRecoveryCodes(_ context.Context, username string) ([]string, error) {
	jsonStr, err := s.Repo.GetRecoveryCodes(username)
	if err != nil || jsonStr == "" {
		return nil, err
	}
	var codes []string
	if err := json.Unmarshal([]byte(jsonStr), &codes); err != nil {
		return nil, err
	}
	return codes, nil
}

func (s *SQLiteUserStore) ConsumeRecoveryCode(_ context.Context, username string, codeHash string) error {
	return s.Repo.ConsumeRecoveryCode(username, codeHash)
}

func toGonetUser(u *model.User) *gonetauth.User {
	if u == nil {
		return nil
	}
	var mfaSecret string
	if u.MFASecret != nil {
		mfaSecret = *u.MFASecret
	}
	return &gonetauth.User{
		ID:             u.ID,
		Username:       u.Username,
		PasswordHash:   u.PasswordHash,
		Role:           u.Role,
		MFASecret:      mfaSecret,
		MFAEnabled:     u.MFAEnabled,
		MFAMandatory:   u.MFAMandatory,
		TokenVersion:   u.TokenVersion,
		FailedAttempts: u.FailedAttempts,
		LockedUntil:    u.LockedUntil,
		CreatedAt:      u.CreatedAt,
		UpdatedAt:      u.UpdatedAt,
	}
}

type SQLiteTokenStore struct {
	Repo repository.RefreshTokenRepository
}

func (s *SQLiteTokenStore) Create(_ context.Context, token *gonetauth.RefreshToken) error {
	return s.Repo.Create(toModelRefreshToken(token))
}

func (s *SQLiteTokenStore) GetByTokenHash(_ context.Context, hash string) (*gonetauth.RefreshToken, error) {
	rt, err := s.Repo.GetByTokenHash(hash)
	if err != nil {
		return nil, err
	}
	return toGonetRefreshToken(rt), nil
}

func (s *SQLiteTokenStore) GetActiveSessions(_ context.Context, username string) ([]gonetauth.SessionInfo, error) {
	sessions, err := s.Repo.GetActiveSessions(username)
	if err != nil {
		return nil, err
	}
	var infos []gonetauth.SessionInfo
	for _, sess := range sessions {
		infos = append(infos, gonetauth.SessionInfo{
			FamilyID:   sess.FamilyID,
			DeviceID:   sess.DeviceID,
			DeviceInfo: sess.DeviceInfo,
			IPAddress:  sess.IPAddress,
			CreatedAt:  sess.CreatedAt.Format(time.RFC3339),
			ExpiresAt:  sess.ExpiresAt.Format(time.RFC3339),
		})
	}
	return infos, nil
}

func (s *SQLiteTokenStore) CountActiveSessions(_ context.Context, username string) (int, error) {
	return s.Repo.CountActiveSessions(username)
}

func (s *SQLiteTokenStore) RevokeByID(_ context.Context, id string) error {
	return s.Repo.RevokeByID(id)
}

func (s *SQLiteTokenStore) RevokeByFamilyID(_ context.Context, familyID string) error {
	return s.Repo.RevokeByFamilyID(familyID)
}

func (s *SQLiteTokenStore) RevokeByUsername(_ context.Context, username string) error {
	return s.Repo.RevokeByUsername(username)
}

func (s *SQLiteTokenStore) RevokeByUsernameAndFamilyID(_ context.Context, username, familyID string) (int64, error) {
	return s.Repo.RevokeByUsernameAndFamilyID(username, familyID)
}

func (s *SQLiteTokenStore) DeleteExpired(_ context.Context) (int64, error) {
	return s.Repo.DeleteExpired()
}

func (s *SQLiteTokenStore) RotateTx(_ context.Context, oldID string, newToken *gonetauth.RefreshToken) error {
	return s.Repo.RotateTx(oldID, toModelRefreshToken(newToken))
}

func toModelRefreshToken(t *gonetauth.RefreshToken) *model.RefreshToken {
	id := t.ID
	if id == "" {
		id = uuid.New().String()
	}
	return &model.RefreshToken{
		ID:         id,
		Username:   t.Username,
		TokenHash:  t.TokenHash,
		FamilyID:   t.FamilyID,
		DeviceID:   t.DeviceID,
		DeviceInfo: t.DeviceInfo,
		IPAddress:  t.IPAddress,
		ExpiresAt:  t.ExpiresAt,
	}
}

func toGonetRefreshToken(rt *model.RefreshToken) *gonetauth.RefreshToken {
	if rt == nil {
		return nil
	}
	return &gonetauth.RefreshToken{
		ID:         rt.ID,
		Username:   rt.Username,
		TokenHash:  rt.TokenHash,
		FamilyID:   rt.FamilyID,
		DeviceID:   rt.DeviceID,
		DeviceInfo: rt.DeviceInfo,
		IPAddress:  rt.IPAddress,
		ExpiresAt:  rt.ExpiresAt,
		IsRevoked:  rt.IsRevoked,
		CreatedAt:  rt.CreatedAt,
	}
}
