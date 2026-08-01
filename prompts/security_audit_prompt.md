# Security Audit Prompt

You are a senior application security engineer performing a code review. Audit the codebase for authentication vulnerabilities, insecure coding patterns, and misconfigurations. Be thorough, specific, and actionable.

## Scope

Focus on:
- Authentication and session management (login, logout, token refresh, MFA)
- Authorization and access control
- Input validation and injection risks
- Cryptographic usage and secrets handling
- Error handling and information disclosure
- Rate limiting and brute-force protections
- Cookie and token security
- Database query patterns
- Configuration and environment variable handling

## Audit Checklist

### 1. Authentication Flow

- [ ] Are passwords hashed with a strong algorithm (bcrypt, argon2)? Never stored in plaintext or weak hashes (MD5, SHA1).
- [ ] Is there a constant-time comparison for password/token verification to prevent timing attacks?
- [ ] Are failed login attempts tracked and accounts locked after a threshold?
- [ ] Is account lockout time-bounded and does it reset after successful login?
- [ ] Are login error messages generic (e.g., "invalid credentials") to prevent user enumeration?
- [ ] Is the `/api/setup/admin` endpoint protected against race conditions (two simultaneous admin creation requests)?
- [ ] Does the setup endpoint return consistent responses whether admin exists or not to avoid leaking state?

### 2. Token Security

- [ ] Are access tokens short-lived (<=15 minutes)?
- [ ] Are refresh tokens stored hashed (not plaintext) in the database?
- [ ] Is refresh token rotation implemented (old token invalidated on use)?
- [ ] Is token family reuse detection implemented (compromised token triggers family revocation)?
- [ ] Are JWTs validated for algorithm, expiration, issuer, and audience?
- [ ] Is the JWT signing key sufficiently strong and kept secret?
- [ ] Are tokens invalidated on password change or logout?
- [ ] Is `TokenVersion` checked on every authenticated request to invalidate stale sessions?

### 3. Cookie Security

- [ ] Are auth cookies set with `HttpOnly`, `Secure`, and `SameSite=Strict` or `Lax`?
- [ ] Is the cookie `Path` scoped appropriately (not `/` if only needed on `/api`)?
- [ ] Are cookie values unpredictable and sufficiently long?
- [ ] Is the `Secure` flag enforced in production (based on `SecureMode` config)?

### 4. MFA Implementation

- [ ] Is the TOTP secret generated using a cryptographically secure random source?
- [ ] Is the TOTP secret encrypted at rest or stored in a secure vault?
- [ ] Are recovery codes hashed before storage?
- [ ] Are recovery codes single-use (consumed after verification)?
- [ ] Is the number of recovery codes bounded and are unused codes invalidated on regeneration?
- [ ] Is MFA verification rate-limited independently of login rate limits?
- [ ] Is there a lockout mechanism for excessive MFA failures?
- [ ] Does the MFA setup flow require re-authentication or a valid session?
- [ ] Is the `pre_auth_token` (MFA pending token) short-lived and single-use?

### 5. Rate Limiting

- [ ] Are all public auth endpoints rate-limited (login, refresh, MFA verify, setup)?
- [ ] Are rate limits applied per-IP with proper trusted proxy handling?
- [ ] Is the rate limiter state cleaned up periodically to prevent memory exhaustion?
- [ ] Are rate limits tested against distributed attacks (multiple IPs)?
- [ ] Does the rate limiter use the correct client IP (not spoofable via `X-Forwarded-For` without trusted proxy config)?

### 6. Input Validation

- [ ] Are all request bodies validated for expected types and lengths?
- [ ] Is username input sanitized and length-bounded?
- [ ] Are device IDs and user-agent strings sanitized before storage?
- [ ] Is HTML entity encoding applied to user-controlled strings rendered in responses?
- [ ] Are SQL queries parameterized (no string concatenation)?
- [ ] Are JSON payloads size-limited to prevent DoS?

### 7. Authorization

- [ ] Are protected routes verified to require authentication (no bypass paths)?
- [ ] Is the `mfaBypassPaths` list minimal and justified?
- [ ] Are role-based access controls enforced server-side, not just client-side?
- [ ] Does the `is_super_admin` flag grant only intended privileges?
- [ ] Can a regular user escalate privileges by manipulating request fields?

### 8. Error Handling and Logging

- [ ] Do error responses avoid leaking stack traces, internal paths, or SQL errors?
- [ ] Are authentication failures logged with IP, username, and timestamp?
- [ ] Are sensitive values (passwords, tokens, secrets) excluded from logs?
- [ ] Is audit logging implemented for security-critical events (login, logout, MFA changes, admin creation)?
- [ ] Are log injection risks mitigated (user input sanitized before logging)?

### 9. Session Management

- [ ] Is there a maximum concurrent session limit per user?
- [ ] Can users view and revoke active sessions?
- [ ] Does logout invalidate both access and refresh tokens server-side?
- [ ] Is the logout endpoint idempotent (safe to call multiple times)?
- [ ] Does the mobile logout properly revoke the session even if refresh token is missing?

### 10. Secrets and Configuration

- [ ] Are secrets (JWT keys, DB credentials) loaded from environment variables, not hardcoded?
- [ ] Is `.env` in `.gitignore`?
- [ ] Are default credentials rejected (no default admin password)?
- [ ] Is the `TRUSTED_PROXY_CIDRS` configuration validated and documented?
- [ ] Are feature flags (e.g., `Auth.AppJwt == "OFF"`) documented and safe in production?

### 11. Mobile API Specifics

- [ ] Does the mobile API use the same security controls as the web API?
- [ ] Are mobile tokens stored securely (not in shared preferences without encryption)?
- [ ] Is the `X-Device-Id` header validated and not trusted without verification?
- [ ] Does the mobile refresh endpoint accept tokens from the body (not cookies) securely?

### 12. Dependency and Library Review

- [ ] Is `gonet-auth` pinned to a specific version in `go.mod`?
- [ ] Are known vulnerabilities in dependencies checked (e.g., `govulncheck`)?
- [ ] Is the `gonet-auth` library audited for its own security practices?
- [ ] Are transitive dependencies reviewed?

## Output Format

For each finding, report:

```
### [SEVERITY] Finding Title

**Location:** `path/to/file.go:line_number`
**Category:** (e.g., Authentication, Token Security, Input Validation)
**Severity:** Critical / High / Medium / Low / Info

**Description:**
What the vulnerability is and why it matters.

**Evidence:**
Relevant code snippet or pattern.

**Recommendation:**
Specific fix or mitigation.

**References:**
OWASP, CWE, or relevant standard.
```

## Severity Definitions

- **Critical**: Immediate exploitation possible, leads to account takeover or data breach
- **High**: Exploitable with moderate effort, significant security impact
- **Medium**: Requires specific conditions or has limited impact
- **Low**: Minor issue, defense-in-depth improvement
- **Info**: Observation, best practice suggestion

## Codebase Context

- **Language**: Go
- **Framework**: Gin (github.com/gin-gonic/gin)
- **Auth Library**: gonet-auth (github.com/leonkhoo123/gonet-auth)
- **Database**: SQLite
- **Auth Methods**: Username/password, TOTP MFA, recovery codes
- **Token Strategy**: JWT access tokens + opaque refresh tokens (cookie-based for web, body-based for mobile)
- **Rate Limiting**: IP-based via gonet-auth ratelimit package

Review all files under `backend/` with emphasis on:
- `backend/internal/controller/routes_setup.go` (route handlers)
- `backend/internal/auth/storage.go` (auth store adapter)
- `backend/internal/repository/` (database queries)
- `backend/internal/model/` (data models)
- `backend/internal/config/` (configuration)
- `backend/cmd/main.go` (app initialization)
