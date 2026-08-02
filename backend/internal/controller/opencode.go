package controller

import (
	"net/http"

	"your-junior/internal/config"
	"your-junior/internal/logger"
	"your-junior/internal/opencode"

	"github.com/gin-gonic/gin"
)

func SetupOpencodeRoutes(router *gin.Engine, cfg *config.CloudConfig, ocManager *opencode.Manager, ocHub *opencode.Hub) {
	handler := &opencodeRouteHandler{
		manager: ocManager,
		hub:     ocHub,
	}

	ocHub.OnCommand = handler.handleCommand

	router.GET("/api/opencode/ws", func(c *gin.Context) {
		ocHub.HandleWS(c.Writer, c.Request)
	})

	router.GET("/api/opencode/status", handler.status)
	router.GET("/api/opencode/providers", handler.providers)
	router.GET("/api/opencode/sessions", handler.sessions)
	router.GET("/api/opencode/sessions/:id/messages", handler.messages)
}

type opencodeRouteHandler struct {
	manager  *opencode.Manager
	hub      *opencode.Hub
	client   *opencode.Client
	sseProxy *opencode.SSEProxy
	session  string
	variant  string
	agent    string
}

func (h *opencodeRouteHandler) status(c *gin.Context) {
	running := h.manager.IsRunning()
	s := "stopped"
	if running {
		s = "running"
	}
	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data": gin.H{
			"status":  s,
			"model":   h.manager.GetModel(),
			"agent":   h.agent,
			"variant": h.variant,
		},
	})
}

func (h *opencodeRouteHandler) providers(c *gin.Context) {
	if !h.manager.IsRunning() {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status":  "error",
			"message": "opencode server not running",
		})
		return
	}
	if h.client == nil {
		h.client = opencode.NewClient(h.manager.GetBaseURL())
		logger.L.Info("lazy-initialized opencode client")
	}

	providersResult, err := h.client.GetProvidersConfig()
	if err != nil {
		logger.L.Error("failed to get providers config", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "failed to get providers: " + err.Error(),
		})
		return
	}

	connectedIDs := []string{}
	allProviders := []opencode.ProviderListItem{}
	providerList, err := h.client.GetProviderList()
	if err != nil {
		logger.L.Warn("failed to get provider list (connected status)", "error", err)
	} else {
		connectedIDs = providerList.Connected
		allProviders = providerList.All
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data": gin.H{
			"providers":     providersResult.Providers,
			"default":       providersResult.Default,
			"connected":     connectedIDs,
			"all_providers": allProviders,
		},
	})
}

func (h *opencodeRouteHandler) sessions(c *gin.Context) {
	if !h.manager.IsRunning() {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status":  "error",
			"message": "opencode server not running",
		})
		return
	}
	if h.client == nil {
		h.client = opencode.NewClient(h.manager.GetBaseURL())
		logger.L.Info("lazy-initialized opencode client")
	}

	sessions, err := h.client.ListSessions()
	if err != nil {
		logger.L.Error("failed to list sessions", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "failed to list sessions: " + err.Error(),
		})
		return
	}

	topLevel := make([]opencode.SessionResponse, 0, len(sessions))
	for _, s := range sessions {
		if s.ParentID == "" {
			topLevel = append(topLevel, s)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   topLevel,
	})
}

func (h *opencodeRouteHandler) messages(c *gin.Context) {
	sessionID := c.Param("id")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "session id is required",
		})
		return
	}

	if !h.manager.IsRunning() {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status":  "error",
			"message": "opencode server not running",
		})
		return
	}
	if h.client == nil {
		h.client = opencode.NewClient(h.manager.GetBaseURL())
		logger.L.Info("lazy-initialized opencode client")
	}

	entries, err := h.client.ListMessages(sessionID)
	if err != nil {
		logger.L.Error("failed to list messages", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "failed to list messages: " + err.Error(),
		})
		return
	}

	type HistoryMessage struct {
		ID        string                  `json:"id"`
		Role      string                  `json:"role"`
		Text      string                  `json:"text"`
		Reasoning string                  `json:"reasoning"`
		Parts     []opencode.MessagePart  `json:"parts,omitempty"`
	}

	result := make([]HistoryMessage, 0, len(entries))
	for _, entry := range entries {
		role := entry.Info.Role
		var text, reasoning string
		var toolParts []opencode.MessagePart

		if entry.Info.Text != "" {
			text = entry.Info.Text
		}

		for _, part := range entry.Parts {
			switch part.Type {
			case "text":
				text += part.Text
			case "reasoning":
				reasoning += part.Text
			case "tool":
				toolParts = append(toolParts, part)
			}
		}

		thinkingTags := opencode.ExtractThinkContent(text)
		if thinkingTags != "" {
			if reasoning == "" {
				reasoning = thinkingTags
			} else {
				reasoning = thinkingTags + "\n" + reasoning
			}
		}
		text = opencode.StripThinkingTags(text)

		result = append(result, HistoryMessage{
			ID:        entry.Info.ID,
			Role:      role,
			Text:      text,
			Reasoning: reasoning,
			Parts:     toolParts,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   result,
	})
}

func (h *opencodeRouteHandler) handleCommand(client *opencode.WSClient, msg opencode.WSMessage) {
	l := logger.L.With("component", "command_handler", "cmd_type", msg.Type)

	switch msg.Type {

	case opencode.WSTypeStartServer:
		l.Info("handling command")
		if h.manager.IsRunning() {
			l.Info("server already running, broadcasting status")
			if h.client == nil {
				h.client = opencode.NewClient(h.manager.GetBaseURL())
				l.Info("lazy-initialized opencode client")
			}
			if h.agent == "" {
				agents, err := h.client.ListAgents()
				if err != nil {
					l.Warn("failed to list agents", "error", err)
					h.agent = "build"
				} else {
					h.agent = "build"
					for _, a := range agents {
						if a.Mode == "primary" {
							h.agent = a.ID
							break
						}
					}
				}
			}
			h.hub.Broadcast(opencode.WSMessage{
				Type: opencode.WSTypeServerStatus,
				Data: map[string]any{
					"status":  "running",
					"model":   h.manager.GetModel(),
					"agent":   h.agent,
					"variant": h.variant,
				},
			})
			return
		}

		if err := h.manager.Start(); err != nil {
			l.Error("failed to start opencode server", "error", err)
			h.hub.BroadcastTo(client, opencode.WSMessage{
				Type: opencode.WSTypeError,
				Data: map[string]any{"message": err.Error()},
			})
			return
		}

		h.client = opencode.NewClient(h.manager.GetBaseURL())
		l.Info("server started", "base_url", h.manager.GetBaseURL(), "model", h.manager.GetModel())

		if h.agent == "" {
			if agents, err := h.client.ListAgents(); err == nil {
				h.agent = "build"
				for _, a := range agents {
					if a.Mode == "primary" {
						h.agent = a.ID
						break
					}
				}
			} else {
				h.agent = "build"
				l.Warn("failed to list agents", "error", err)
			}
		}

		if h.sseProxy != nil {
			h.sseProxy.Stop()
		}
		h.sseProxy = opencode.NewSSEProxy(h.manager, h.hub)
		go h.sseProxy.Start()

		h.hub.Broadcast(opencode.WSMessage{
			Type: opencode.WSTypeServerStatus,
			Data: map[string]any{
				"status":  "running",
				"model":   h.manager.GetModel(),
				"agent":   h.agent,
				"variant": h.variant,
			},
		})

	case opencode.WSTypeStopServer:
		l.Info("handling command")
		if h.sseProxy != nil {
			h.sseProxy.Stop()
			h.sseProxy = nil
		}
		if err := h.manager.Stop(); err != nil {
			l.Warn("error stopping opencode", "error", err)
		}
		h.session = ""
		h.variant = ""
		h.agent = ""
		h.client = nil
		l.Info("server stopped")
		h.hub.Broadcast(opencode.WSMessage{
			Type: opencode.WSTypeServerStatus,
			Data: map[string]any{"status": "stopped"},
		})

	case opencode.WSTypeGetProviders:
		l.Info("handling command")
		if h.client == nil {
			if h.manager.IsRunning() {
				h.client = opencode.NewClient(h.manager.GetBaseURL())
				l.Info("lazy-initialized opencode client")
			} else {
				h.hub.BroadcastTo(client, opencode.WSMessage{
					Type: opencode.WSTypeError,
					Data: map[string]any{"message": "opencode server not running"},
				})
				return
			}
		}
		result, err := h.client.GetProvidersConfig()
		if err != nil {
			l.Error("failed to get providers", "error", err)
			h.hub.BroadcastTo(client, opencode.WSMessage{
				Type: opencode.WSTypeError,
				Data: map[string]any{"message": "failed to get providers: " + err.Error()},
			})
			return
		}
		h.hub.BroadcastTo(client, opencode.WSMessage{
			Type: opencode.WSTypeProvidersList,
			Data: map[string]any{
				"providers": result.Providers,
				"default":   result.Default,
			},
		})

	case opencode.WSTypeSetModel:
		model, _ := msg.Data["model"].(string)
		variant, _ := msg.Data["variant"].(string)
		l.Info("handling command", "model", model, "variant", variant)

		if model == "" {
			h.hub.BroadcastTo(client, opencode.WSMessage{
				Type: opencode.WSTypeError,
				Data: map[string]any{"message": "model is required"},
			})
			return
		}
		if h.client == nil {
			if h.manager.IsRunning() {
				h.client = opencode.NewClient(h.manager.GetBaseURL())
				l.Info("lazy-initialized opencode client")
			} else {
				h.hub.BroadcastTo(client, opencode.WSMessage{
					Type: opencode.WSTypeError,
					Data: map[string]any{"message": "opencode server not running"},
				})
				return
			}
		}

		if err := h.manager.WriteProjectConfig(model); err != nil {
			l.Error("failed to write opencode.json", "error", err)
			h.hub.BroadcastTo(client, opencode.WSMessage{
				Type: opencode.WSTypeError,
				Data: map[string]any{"message": "failed to set model: " + err.Error()},
			})
			return
		}

		if err := h.client.DisposeInstance(); err != nil {
			l.Warn("failed to dispose instance after model change", "error", err)
		}

		h.manager.SetModel(model)
		if variant != "" {
			h.variant = variant
		} else {
			h.variant = ""
		}
		h.session = ""

		h.hub.Broadcast(opencode.WSMessage{
			Type: opencode.WSTypeModelChanged,
			Data: map[string]any{
				"model":   model,
				"variant": variant,
			},
		})

	case opencode.WSTypeSetAuthKey:
		providerID, _ := msg.Data["provider_id"].(string)
		apiKey, _ := msg.Data["api_key"].(string)
		l.Info("handling command", "provider", providerID)

		if providerID == "" || apiKey == "" {
			h.hub.BroadcastTo(client, opencode.WSMessage{
				Type: opencode.WSTypeError,
				Data: map[string]any{"message": "provider_id and api_key are required"},
			})
			return
		}
		if h.client == nil {
			if h.manager.IsRunning() {
				h.client = opencode.NewClient(h.manager.GetBaseURL())
				l.Info("lazy-initialized opencode client")
			} else {
				h.hub.BroadcastTo(client, opencode.WSMessage{
					Type: opencode.WSTypeError,
					Data: map[string]any{"message": "opencode server not running"},
				})
				return
			}
		}

		if err := h.client.SetAuth(providerID, apiKey); err != nil {
			l.Error("failed to set auth key", "error", err)
			h.hub.BroadcastTo(client, opencode.WSMessage{
				Type: opencode.WSTypeError,
				Data: map[string]any{"message": "failed to set API key: " + err.Error()},
			})
			return
		}

		if err := h.client.DisposeInstance(); err != nil {
			l.Warn("failed to dispose instance after auth", "error", err)
		}

		h.session = ""

		h.hub.Broadcast(opencode.WSMessage{
			Type: opencode.WSTypeServerStatus,
			Data: map[string]any{
				"status":  "running",
				"model":   h.manager.GetModel(),
				"agent":   h.agent,
				"variant": h.variant,
			},
		})

		l.Info("auth key set and instance disposed", "provider", providerID)

	case opencode.WSTypeCreateSession:
		l.Info("handling command")
		if h.client == nil {
			if h.manager.IsRunning() {
				h.client = opencode.NewClient(h.manager.GetBaseURL())
				l.Info("lazy-initialized opencode client")
			} else {
				l.Warn("client is nil, server not running")
				h.hub.BroadcastTo(client, opencode.WSMessage{
					Type: opencode.WSTypeError,
					Data: map[string]any{"message": "opencode server not running"},
				})
				return
			}
		}
		session, err := h.client.CreateSession(h.manager.GetModel(), h.variant)
		if err != nil {
			l.Error("failed to create session", "error", err)
			h.hub.BroadcastTo(client, opencode.WSMessage{
				Type: opencode.WSTypeError,
				Data: map[string]any{"message": "failed to create session: " + err.Error()},
			})
			return
		}
		h.session = session.ID
		l.Info("session created", "session_id", session.ID)
		h.hub.BroadcastTo(client, opencode.WSMessage{
			Type: opencode.WSTypeSessionCreated,
			Data: map[string]any{"session_id": session.ID},
		})

	case opencode.WSTypeSendMessage:
		text, _ := msg.Data["text"].(string)
		sessionID, _ := msg.Data["session_id"].(string)
		if sessionID == "" {
			sessionID = h.session
		}

		l.Info("handling command", "session_id", sessionID, "text_len", len(text), "text_preview", truncate(text, 100))

		if sessionID == "" || text == "" {
			l.Warn("missing required fields", "has_session", sessionID != "", "has_text", text != "")
			h.hub.BroadcastTo(client, opencode.WSMessage{
				Type: opencode.WSTypeError,
				Data: map[string]any{"message": "session_id and text are required"},
			})
			return
		}
		if h.client == nil {
			if h.manager.IsRunning() {
				h.client = opencode.NewClient(h.manager.GetBaseURL())
				l.Info("lazy-initialized opencode client")
			} else {
				l.Warn("client is nil, server not running")
				h.hub.BroadcastTo(client, opencode.WSMessage{
					Type: opencode.WSTypeError,
					Data: map[string]any{"message": "opencode server not running"},
				})
				return
			}
		}
		if err := h.client.SendPromptAsync(sessionID, text); err != nil {
			l.Error("failed to send message", "error", err)
			h.hub.BroadcastTo(client, opencode.WSMessage{
				Type: opencode.WSTypeError,
				Data: map[string]any{"message": "failed to send message: " + err.Error()},
			})
			return
		}

		l.Info("message sent to opencode", "session_id", sessionID)

	default:
		l.Debug("unhandled message type", "type", msg.Type)
	}
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}
