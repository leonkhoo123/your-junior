# AGENTS.md

## Project Context

The `gonet_auth` package (Go-based authentication library) is located at **`../gonet-auth`** relative to this project root. When working with authentication-related code, reference or import from that path.

If anything about opencode is unclear, refer to its source code at **`/home/leon/Documents/others_git/opencode-dev`**.

## Code Quality Rules

### File Length Limit (Apply to Both Go and React TypeScript)

- **Maximum file length: ~600 lines** (including imports, comments, and blank lines)
- If a file exceeds this limit, split it using the strategies below

#### Go File Splitting Strategies

| File Type | Split Approach |
|-----------|----------------|
| Large handler/controller | Extract middleware, validators, or route groups into separate files |
| Long service layer | Split by domain operation (e.g., `user_service_create.go`, `user_service_auth.go`) |
| Complex repository | Separate read vs write operations, or split by aggregate |
| Big model file | Split into `model_user.go`, `model_user_dto.go`, `model_user_validation.go` |

#### React TypeScript File Splitting Strategies

| File Type | Split Approach |
|-----------|----------------|
| Large component (>300 lines) | Extract sub-components, hooks, and utils into separate files |
| Long page component | Split into `PageNameHeader.tsx`, `PageNameContent.tsx`, `PageNameForm.tsx` |
| Complex form | Extract form sections into components, custom hooks for form logic |
| API layer | Split by domain (e.g., `api-auth.ts`, `api-users.ts`, `api-projects.ts`) |
| Custom hooks | Split complex hooks into smaller focused hooks |

---

## Go Backend Best Practices

### Project Structure
```
backend/
├── cmd/              # Application entrypoints
├── internal/         # Private application code
│   ├── config/       # Configuration loading
│   ├── controller/   # HTTP handlers (thin layer)
│   ├── service/      # Business logic
│   ├── repository/   # Data access layer
│   ├── model/        # Domain models & DTOs
│   ├── middleware/    # HTTP middleware
│   ├── auth/         # Authentication logic
│   └── util/         # Shared utilities
├── go.mod
└── go.sum
```

### Naming Conventions
- **Files**: `snake_case.go` (e.g., `user_repository.go`, `auth_service.go`)
- **Interfaces**: Verb + Noun pattern (e.g., `UserCreator`, `TokenValidator`, `PasswordHasher`)
- **Structs**: PascalCase, no `I` prefix for interfaces
- **Exported functions**: PascalCase, descriptive verbs (e.g., `CreateUser`, `ValidateToken`)
- **Unexported functions**: camelCase

### Code Style
- Use `gofmt` and `golangci-lint` — never commit unformatted code
- Prefer table-driven tests with `t.Run` subtests
- Return errors, don't panic — use `fmt.Errorf("context: %w", err)` for wrapping
- Keep interfaces small (1-3 methods) — accept interfaces, return structs
- Use context.Context as first parameter for cancellable/database operations
- Avoid package-level state; use dependency injection via constructors

### Error Handling
```go
// Good: Wrap errors with context
if err != nil {
    return fmt.Errorf("failed to get user by ID %d: %w", id, err)
}

// Bad: Bare errors lose context
if err != nil {
    return err
}
```

### Dependency Injection
```go
// Good: Constructor injection
type UserService struct {
    repo UserRepository
    hasher PasswordHasher
}

func NewUserService(repo UserRepository, hasher PasswordHasher) *UserService {
    return &UserService{repo: repo, hasher: hasher}
}
```

---

## React TypeScript Frontend Best Practices

### Project Structure
```
frontend/src/
├── api/              # API client functions
├── components/       # Reusable UI components
│   ├── ui/           # Generic UI primitives (buttons, inputs)
│   └── auth/         # Domain-specific components
├── hooks/            # Custom React hooks
├── layouts/          # Layout wrapper components
├── pages/            # Page-level components (route targets)
├── context/          # React context providers
├── utils/            # Pure utility functions
└── lib/              # Third-party library wrappers
```

### Naming Conventions
- **Components**: PascalCase files and exports (e.g., `UserProfile.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useAuth.ts`, `useDebounce.ts`)
- **API functions**: camelCase with domain prefix (e.g., `api-auth.tsx`, `api-users.ts`)
- **Utils**: camelCase (e.g., `formatDate.ts`, `validateEmail.ts`)
- **Types/Interfaces**: PascalCase, no `I` prefix (e.g., `User`, `AuthState`)

### Component Guidelines
- **One component per file** — if a file has multiple components, split them
- Extract complex logic into custom hooks (keep components focused on rendering)
- Use TypeScript strictly — avoid `any`, define proper prop types
- Prefer named exports over default exports for better refactoring

### Hooks Pattern
```typescript
// Good: Small, focused hooks
function useUser(userId: string) {
  return useQuery({ queryKey: ['user', userId], queryFn: () => fetchUser(userId) });
}

// Good: Extract form logic
function useLoginForm() {
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  // ... form logic
  return { credentials, setCredentials, handleSubmit, errors };
}
```

### Component Composition Pattern
```typescript
// Good: Split large page into sub-components
// pages/UserPage.tsx
export function UserPage() {
  return (
    <Layout>
      <UserPageHeader />
      <UserPageContent />
    </Layout>
  );
}

// pages/UserPageHeader.tsx (extracted)
export function UserPageHeader() { /* ... */ }

// pages/UserPageContent.tsx (extracted)
export function UserPageContent() { /* ... */ }
```

### API Layer
- Keep API functions in `src/api/` — never call axios/fetch directly in components
- Use typed request/response interfaces
- Group by domain: `api-auth.ts`, `api-users.ts`, `api-projects.ts`

---

## Updating gonet-auth dependency

gonet-auth is a private GitHub module (`github.com/leonkhoo123/gonet-auth`). To bump the version:

```bash
# 1. Update the version in go.mod
go mod edit -require github.com/leonkhoo123/gonet-auth@v0.2.0

# 2. Drop the local replace so Go fetches from GitHub
go mod edit -dropreplace github.com/leonkhoo123/gonet-auth

# 3. Fetch from GitHub and regenerate go.sum
GOPRIVATE=github.com/leonkhoo123 go mod tidy

# 4. Restore the local replace for dev
go mod edit -replace github.com/leonkhoo123/gonet-auth=../gonet-auth

# 5. Commit the updated go.mod + go.sum
git add go.mod go.sum && git commit -m "bump gonet-auth to v0.2.0"
```

Never commit the repo without the `replace` directive — it must be present in every commit so local dev works. The Docker pipeline drops it at build time.
