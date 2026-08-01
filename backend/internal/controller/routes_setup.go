package controller

import (
	"net"
	"net/http"
	"strings"
	"time"

	"your-junior/internal/config"
	"your-junior/internal/logger"

	gonetauth "github.com/leonkhoo123/gonet-auth"
	"github.com/leonkhoo123/gonet-auth/auth"
	"github.com/leonkhoo123/gonet-auth/ratelimit"
	authgin "github.com/leonkhoo123/gonet-auth/adapters/gin"

	"github.com/gin-gonic/gin"
)

var (
	loginStore        = NewMemoryRateLimiterStore(1, 5)
	mobileLoginStore  = NewMemoryRateLimiterStore(1, 5)
	mobileMfaStore    = NewMemoryRateLimiterStore(1, 5)
	refreshStore      = NewMemoryRateLimiterStore(5, 10)
	setupStore        = NewMemoryRateLimiterStore(1, 5)
	logoutStore       = NewMemoryRateLimiterStore(5, 10)

	loginLimiter       = ratelimit.NewIPRateLimiter(loginStore)
	mobileLoginLimiter = ratelimit.NewIPRateLimiter(mobileLoginStore)
	mobileMfaLimiter   = ratelimit.NewIPRateLimiter(mobileMfaStore)
	refreshLimiter     = ratelimit.NewIPRateLimiter(refreshStore)
	setupLimiter       = ratelimit.NewIPRateLimiter(setupStore)
	logoutLimiter      = ratelimit.NewIPRateLimiter(logoutStore)
)

func StartLimiterCleanup() {
	interval := 5 * time.Minute
	loginStore.StartCleanupScheduler(interval)
	mobileLoginStore.StartCleanupScheduler(interval)
	mobileMfaStore.StartCleanupScheduler(interval)
	refreshStore.StartCleanupScheduler(interval)
	setupStore.StartCleanupScheduler(interval)
	logoutStore.StartCleanupScheduler(interval)
}

func ConfigureTrustedProxies(cidrs []string, appEnv string) {
	if len(cidrs) == 0 {
		if strings.EqualFold(appEnv, "prod") {
			logger.L.Fatal("TRUSTED_PROXY_CIDRS required in production — rate limiter cannot trust X-Forwarded-For without configured proxies")
		}
		logger.L.Warn("no TRUSTED_PROXY_CIDRS configured — X-Forwarded-For / X-Real-IP are trusted from all sources; configure proxy CIDRs to restrict")
		return
	}
	var valid []string
	for _, cidr := range cidrs {
		if _, _, err := net.ParseCIDR(cidr); err != nil {
			logger.L.Warn("skipping invalid TRUSTED_PROXY_CIDRS entry", "cidr", cidr, "error", err.Error())
			continue
		}
		valid = append(valid, cidr)
	}
	if len(valid) == 0 {
		if strings.EqualFold(appEnv, "prod") {
			logger.L.Fatal("TRUSTED_PROXY_CIDRS required in production — all configured entries were invalid")
		}
		logger.L.Warn("all TRUSTED_PROXY_CIDRS entries were invalid — no trusted proxies configured")
		return
	}
	loginLimiter.SetTrustedProxies(valid...)
	mobileLoginLimiter.SetTrustedProxies(valid...)
	mobileMfaLimiter.SetTrustedProxies(valid...)
	refreshLimiter.SetTrustedProxies(valid...)
	setupLimiter.SetTrustedProxies(valid...)
	logoutLimiter.SetTrustedProxies(valid...)
}

func SetupPublicAuthRoutes(router *gin.Engine, cfg *config.CloudConfig, authInstance *auth.Auth, authCfg *gonetauth.AuthConfig) {
	h := authgin.NewHandlers(authInstance, authCfg)

	api := router.Group("/api")
	{
		api.POST("/login", authgin.RateLimitMiddleware(loginLimiter), h.Login())
		api.POST("/refresh", authgin.RateLimitMiddleware(refreshLimiter), h.Refresh())
		api.POST("/mfa/verify", authgin.RateLimitMiddleware(loginLimiter), h.MFAVerify())
		api.POST("/mfa/recovery", authgin.RateLimitMiddleware(loginLimiter), h.MFARecovery())
		api.POST("/logout", authgin.RateLimitMiddleware(logoutLimiter), h.Logout())

		// Admin provisioning — only works once when no admin exists
		api.POST("/admin/provision", authgin.RateLimitMiddleware(setupLimiter), h.ProvisionAdmin())

		// Setup status check (thin wrapper)
		api.GET("/setup/status", h.SetupStatus())
	}
}

func SetupMobileAuthRoutes(router *gin.Engine, cfg *config.CloudConfig, authInstance *auth.Auth, authCfg *gonetauth.AuthConfig) {
	h := authgin.NewHandlers(authInstance, authCfg)

	api := router.Group("/api/mobile")
	{
		api.POST("/login", authgin.RateLimitMiddleware(mobileLoginLimiter), h.Login())
		api.POST("/refresh", authgin.RateLimitMiddleware(refreshLimiter), h.Refresh())
		api.POST("/mfa/verify", authgin.RateLimitMiddleware(mobileMfaLimiter), h.MFAVerify())
		api.POST("/mfa/recovery", authgin.RateLimitMiddleware(mobileMfaLimiter), h.MFARecovery())
		api.POST("/logout", authgin.RateLimitMiddleware(logoutLimiter), h.Logout())
	}
}

var mfaBypassPaths = []string{"/api/auth/mfa/setup", "/api/auth/mfa/confirm"}

func SetupAdminRoutes(router *gin.Engine, authInstance *auth.Auth, authCfg *gonetauth.AuthConfig) {
	h := authgin.NewHandlers(authInstance, authCfg)

	adminRouter := router.Group("/api/admin")
	adminRouter.Use(authgin.JWTAuthMiddleware(authInstance, nil))
	adminRouter.Use(authgin.AdminMiddleware(authInstance))
	{
		adminRouter.POST("/users", h.CreateUser())
		adminRouter.DELETE("/users/:id", h.DeleteUser())
		adminRouter.POST("/users/:id/revoke-all", h.RevokeAllSessions())
	}
}

func SetupAuthenticatedRoutes(router *gin.Engine, authInstance *auth.Auth, authCfg *gonetauth.AuthConfig) {
	h := authgin.NewHandlers(authInstance, authCfg)

	authRouter := router.Group("/api/auth")
	authRouter.Use(authgin.JWTAuthMiddleware(authInstance, mfaBypassPaths))
	{
		authRouter.GET("/me", userMeHandler())
		authRouter.GET("/sessions", h.GetSessions())
		authRouter.POST("/sessions/revoke", h.RevokeSession())
		authRouter.POST("/mfa/setup", authgin.RateLimitMiddleware(loginLimiter), h.MFASetup())
		authRouter.POST("/mfa/confirm", authgin.RateLimitMiddleware(loginLimiter), h.MFAConfirm())
	}
}

func userMeHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		username := c.GetString(authgin.KeyUsername)
		role := c.GetString(authgin.KeyRole)

		c.JSON(http.StatusOK, gin.H{
			"status": "success",
			"data": gin.H{
				"username": username,
				"role":     role,
			},
		})
	}
}
