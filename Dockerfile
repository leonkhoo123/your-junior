# syntax=docker/dockerfile:1
# ====== 1. Frontend Build Stage ======
FROM node:20-alpine AS frontend-builder

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY frontend/ ./
ENV VITE_PROFILE=prod
RUN npm run build

# ====== 2. Backend Build Stage ======
FROM golang:1.25.10-alpine AS backend-builder

RUN apk add --no-cache git gcc musl-dev vips-dev

WORKDIR /app

ENV GOPRIVATE=github.com/leonkhoo123

ARG GITHUB_TOKEN
RUN git config --global url."https://${GITHUB_TOKEN}:x-oauth-basic@github.com/".insteadOf "https://github.com/"

COPY backend/go.mod backend/go.sum ./

RUN go mod edit \
    -dropreplace github.com/leonkhoo123/gonet-auth \
    -dropreplace github.com/leonkhoo123/gonet-auth/adapters/gin

RUN --mount=type=cache,target=/go/pkg/mod go mod download
RUN git config --global --unset url."https://${GITHUB_TOKEN}:x-oauth-basic@github.com/".insteadOf

COPY backend/. .

RUN mkdir -p ui/dist
COPY --from=frontend-builder /app/dist ./ui/dist/

RUN --mount=type=cache,target=/root/.cache/go-build \
    --mount=type=cache,target=/go/pkg/mod \
    go mod edit \
      -dropreplace github.com/leonkhoo123/gonet-auth \
      -dropreplace github.com/leonkhoo123/gonet-auth/adapters/gin && \
    CGO_ENABLED=1 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-s -w" -trimpath -o server ./cmd/main.go

# ====== 3. Runtime stage ======
FROM alpine:latest

RUN apk add --no-cache vips ca-certificates nodejs npm

RUN npm install -g opencode-ai

WORKDIR /root/

COPY --from=backend-builder /app/server .

COPY backend/project/ ./project/

EXPOSE 8080

CMD ["./server"]
