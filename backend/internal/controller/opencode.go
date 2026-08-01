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
}

type opencodeRouteHandler struct {
	manager *opencode.Manager
	hub     *opencode.Hub
	client  *opencode.Client
	session string
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
			"status": s,
			"model":  h.manager.GetModel(),
		},
	})
}

func (h *opencodeRouteHandler) handleCommand(client *opencode.WSClient, msg opencode.WSMessage) {
	l := logger.L.With("component", "command_handler", "cmd_type", msg.Type)

	switch msg.Type {

	case opencode.WSTypeStartServer:
		l.Info("handling command")
		if h.manager.IsRunning() {
			l.Info("server already running, broadcasting status")
			h.hub.Broadcast(opencode.WSMessage{
				Type: opencode.WSTypeServerStatus,
				Data: map[string]any{
					"status": "running",
					"model":  h.manager.GetModel(),
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

		go opencode.NewSSEProxy(h.manager, h.hub).Start()

		h.hub.Broadcast(opencode.WSMessage{
			Type: opencode.WSTypeServerStatus,
			Data: map[string]any{
				"status": "running",
				"model":  h.manager.GetModel(),
			},
		})

	case opencode.WSTypeStopServer:
		l.Info("handling command")
		if err := h.manager.Stop(); err != nil {
			l.Warn("error stopping opencode", "error", err)
		}
		h.session = ""
		h.client = nil
		l.Info("server stopped")
		h.hub.Broadcast(opencode.WSMessage{
			Type: opencode.WSTypeServerStatus,
			Data: map[string]any{"status": "stopped"},
		})

	case opencode.WSTypeCreateSession:
		l.Info("handling command")
		if h.client == nil {
			l.Warn("client is nil, server not running")
			h.hub.BroadcastTo(client, opencode.WSMessage{
				Type: opencode.WSTypeError,
				Data: map[string]any{"message": "opencode server not running"},
			})
			return
		}
		session, err := h.client.CreateSession("Chat")
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
			l.Warn("client is nil, server not running")
			h.hub.BroadcastTo(client, opencode.WSMessage{
				Type: opencode.WSTypeError,
				Data: map[string]any{"message": "opencode server not running"},
			})
			return
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
