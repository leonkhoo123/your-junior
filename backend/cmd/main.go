package main

import (
	"context"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	authpkg "your-junior/internal/auth"
	"your-junior/internal/config"
	"your-junior/internal/controller"
	"your-junior/internal/logger"
	"your-junior/internal/opencode"
	"your-junior/internal/repository"
	"your-junior/internal/service"
	"your-junior/ui"

	gonetauth "github.com/leonkhoo123/gonet-auth"
	"github.com/leonkhoo123/gonet-auth/auth"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/patrickmn/go-cache"
)

func main() {
	cfg := config.Load()

	logger.Init(parseLogLevel(cfg.Server.LogLevel), cfg.Server.AppEnv)

	config.InitDB()
	defer config.DB.Close()

	router := gin.New()
	router.Use(logger.RequestIDMiddleware())
	router.Use(logger.RequestLoggerMiddleware())
	router.Use(gin.Recovery())
	router.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.Server.AllowedOrigins,
		AllowCredentials: true,
		AllowMethods:     []string{"GET", "HEAD", "OPTIONS", "POST", "PUT", "DELETE"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Device-Id"},
	}))
	router.Use(SecurityHeadersMiddleware())

	router.GET("/api/health", healthHandler(cfg))

	repo := repository.NewSQLiteUserRepo(config.DB)
	tokenRepo := repository.NewSQLiteRefreshTokenRepo(config.DB)

	// Build config using builder pattern
	authCfg := gonetauth.NewDefaultConfig().
		WithSecretStore(&config.SQLiteSecretStore{DB: config.DB}).
		WithSecureMode(cfg.Auth.SecureMode).
		WithMFA(cfg.Defaults.ServiceName, 5, 15*time.Minute).
		WithJWTOff(cfg.Auth.AppJwt == "OFF").
		WithAuditRetention(30)

	if authCfg.JWTOff {
		if strings.EqualFold(cfg.Server.AppEnv, "prod") {
			logger.L.Fatal("JWTOff is not allowed in production",
				"app_env", cfg.Server.AppEnv,
			)
		}
		if !cfg.Auth.AllowUnsafeUnprotectedMode {
			logger.L.Fatal("JWTOff requires ALLOW_UNSAFE_UNPROTECTED_MODE=true to confirm intent",
				"app_env", cfg.Server.AppEnv,
			)
		}
		logger.L.Warn(
			"!!! JWTOff mode is enabled — ALL authentication is bypassed !!!",
			"app_env", cfg.Server.AppEnv,
			"allow_unsafe_unprotected_mode", cfg.Auth.AllowUnsafeUnprotectedMode,
		)
	}

	userStore := &authpkg.SQLiteUserStore{Repo: repo}
	tokenStore := &authpkg.SQLiteTokenStore{Repo: tokenRepo}
	auditLogStore := &config.SQLiteAuditLogStore{DB: config.DB}

	authLogFn := func(msg string, keyvals ...any) {
		switch msg {
		case "debug":
			logger.L.Debug(keyvals[0].(string), keyvals[1:]...)
		case "info":
			logger.L.Info(keyvals[0].(string), keyvals[1:]...)
		case "error":
			logger.L.Error(keyvals[0].(string), keyvals[1:]...)
		case "warn":
			logger.L.Warn(keyvals[0].(string), keyvals[1:]...)
		default:
			logger.L.Info(keyvals[0].(string), keyvals[1:]...)
		}
	}

	// NewAuth with functional options
	authInstance := auth.NewAuth(authCfg, userStore, tokenStore,
		auth.WithMFA(userStore),
		auth.WithLockout(userStore),
		auth.WithCacheFactory(func() gonetauth.CacheStore {
			return cache.New(20*time.Minute, 30*time.Minute)
		}),
		auth.WithMFAFailedCacheFactory(func() gonetauth.CacheStore {
			return cache.New(15*time.Minute, 30*time.Minute)
		}),
		auth.WithMFAJTICacheFactory(func() gonetauth.CacheStore {
			return cache.New(20*time.Minute, 30*time.Minute)
		}),
		auth.WithLogFn(authLogFn),
		auth.WithAuditLog(auditLogStore),
	)

	// Start() triggers OnFirstRun — if it fails, server stops
	if err := authInstance.Start(); err != nil {
		logger.L.Fatal("auth initialization failed", "error", err)
	}
	defer authInstance.Shutdown()

	ocConfig := opencode.DefaultConfig()
	ocManager := opencode.NewManager(ocConfig)

	projectRepo := repository.NewSQLiteProjectRepo(config.DB)
	worktreeRepo := repository.NewSQLiteWorktreeRepo(config.DB)
	projectSvc := service.NewProjectService(projectRepo, worktreeRepo, ocConfig.WorkDir)
	worktreeSvc := service.NewWorktreeService(worktreeRepo, projectRepo, ocConfig.WorkDir)

	defer func() {
		if err := ocManager.Stop(); err != nil {
			logger.L.Warn("error stopping opencode", "error", err)
		}
	}()

	ocHub := opencode.NewHub()
	go ocHub.Run()

	controller.StartLimiterCleanup()
	controller.ConfigureTrustedProxies(cfg.Auth.TrustedProxyCIDRs, cfg.Server.AppEnv)

	controller.SetupPublicAuthRoutes(router, cfg, authInstance, authCfg)
	controller.SetupMobileAuthRoutes(router, cfg, authInstance, authCfg)
	controller.SetupAuthenticatedRoutes(router, authInstance, authCfg)
	controller.SetupAdminRoutes(router, authInstance, authCfg)

	controller.SetupOpencodeRoutes(router, cfg, ocManager, ocHub, worktreeSvc)
	controller.SetupGitRoutes(router, projectSvc, worktreeSvc)

	distFS, err := fs.Sub(ui.Assets, "dist")
	if err != nil {
		logger.L.Fatal("failed to create sub filesystem", "err", err)
	}

	fileServer := http.FileServer(http.FS(distFS))

	router.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path

		if strings.HasPrefix(path, "/api") {
			c.JSON(http.StatusNotFound, gin.H{"status": "error", "error": "API route not found"})
			return
		}

		if _, err := fs.Stat(distFS, strings.TrimPrefix(path, "/")); err == nil {
			fileServer.ServeHTTP(c.Writer, c.Request)
			return
		}

		c.Request.URL.Path = "/"
		fileServer.ServeHTTP(c.Writer, c.Request)
	})

	srv := &http.Server{
		Addr:    cfg.Server.ListenAddr,
		Handler: router,
	}

	go func() {
		logger.L.Info("starting server", "addr", cfg.Server.ListenAddr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.L.Fatal("server start failed", "err", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	logger.L.Info("shutting down")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		logger.L.Fatal("forced shutdown", "err", err)
	}

	logger.L.Info("server exited gracefully")
}

func SecurityHeadersMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
		c.Header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		c.Header("Server", "")
		c.Next()
	}
}

func healthHandler(cfg *config.CloudConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "success",
			"data": gin.H{
				"service_name": cfg.Defaults.ServiceName,
			},
		})
	}
}

func parseLogLevel(level string) slog.Level {
	switch strings.ToLower(level) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}
