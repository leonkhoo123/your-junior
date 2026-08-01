# AGENTS.md

## Project Context

The `gonet_auth` package (Go-based authentication library) is located at **`../gonet-auth`** relative to this project root. When working with authentication-related code, reference or import from that path.

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
