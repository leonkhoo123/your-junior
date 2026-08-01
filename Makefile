.PHONY: build run test lint dev-frontend dev-backend clean

build:
	cd backend && go build -o ../server ./cmd/main.go

run:
	cd backend && go run ./cmd/main.go

test:
	cd backend && go test ./...

test-cover:
	cd backend && go test -cover ./...

lint:
	cd backend && golangci-lint run ./...

dev-frontend:
	cd frontend && npm run dev

dev-backend:
	cd backend && go run ./cmd/main.go

clean:
	rm -f server
	rm -rf backend/ui/dist
	rm -rf frontend/dist
