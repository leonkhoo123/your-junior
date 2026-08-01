package model

import "time"

type User struct {
	ID             string     `json:"id"`
	Username       string     `json:"username"`
	PasswordHash   string     `json:"-"`
	Role           string     `json:"role"`
	MFASecret      *string    `json:"-"`
	MFAEnabled     bool       `json:"mfa_enabled"`
	MFAMandatory   bool       `json:"mfa_mandatory"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
	FailedAttempts int        `json:"failed_attempts"`
	LockedUntil    *time.Time `json:"locked_until"`
	RecoveryCodes *string `json:"-"`
	TokenVersion  int     `json:"token_version"`
}
