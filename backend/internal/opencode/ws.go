package opencode

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"your-junior/internal/logger"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 65536
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type WSMessageType string

const (
	WSTypeStartServer   WSMessageType = "start_server"
	WSTypeStopServer    WSMessageType = "stop_server"
	WSTypeSendMessage   WSMessageType = "send_message"
	WSTypeCreateSession WSMessageType = "create_session"
	WSTypeGetProviders  WSMessageType = "get_providers"
	WSTypeSetModel      WSMessageType = "set_model"
	WSTypeSetAuthKey    WSMessageType = "set_auth_key"

	WSTypeServerStatus   WSMessageType = "server_status"
	WSTypeSessionCreated WSMessageType = "session_created"
	WSTypeChatMessage    WSMessageType = "chat_message"
	WSTypeChatComplete   WSMessageType = "chat_complete"
	WSTypeProvidersList  WSMessageType = "providers_list"
	WSTypeModelChanged   WSMessageType = "model_changed"
	WSTypeError          WSMessageType = "error"
	WSTypePartUpdated    WSMessageType = "part_updated"
	WSTypeSessionUpdated WSMessageType = "session_updated"
	WSTypeAgentChanged   WSMessageType = "agent_changed"
)

type WSMessage struct {
	Type      WSMessageType  `json:"type"`
	Directory string         `json:"directory,omitempty"`
	Data      map[string]any `json:"data,omitempty"`
}

type WSClient struct {
	hub  *Hub
	conn *websocket.Conn
	send chan []byte
}

type Hub struct {
	mu         sync.RWMutex
	clients    map[*WSClient]bool
	register   chan *WSClient
	unregister chan *WSClient
	broadcast  chan []byte
	OnCommand  func(*WSClient, WSMessage)
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*WSClient]bool),
		register:   make(chan *WSClient),
		unregister: make(chan *WSClient),
		broadcast:  make(chan []byte, 256),
	}
}

func (h *Hub) Run() {
	l := logger.L.With("component", "ws_hub")
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			clientCount := len(h.clients)
			h.mu.Unlock()
			l.Info("client connected", "client_count", clientCount)

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			clientCount := len(h.clients)
			h.mu.Unlock()
			l.Info("client disconnected", "client_count", clientCount)

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					h.mu.RUnlock()
					h.mu.Lock()
					delete(h.clients, client)
					close(client.send)
					h.mu.Unlock()
					h.mu.RLock()
					l.Warn("client send buffer full, dropping client")
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) HandleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		logger.L.Error("websocket upgrade failed", "error", err)
		return
	}

	logger.L.Info("websocket connection upgraded",
		"remote_addr", r.RemoteAddr,
		"user_agent", r.UserAgent(),
	)

	client := &WSClient{
		hub:  h,
		conn: conn,
		send: make(chan []byte, 256),
	}

	h.register <- client

	go client.writePump()
	go client.readPump()
}

func (h *Hub) Broadcast(msg WSMessage) {
	l := logger.L.With("component", "ws_hub")
	data, err := json.Marshal(msg)
	if err != nil {
		l.Error("failed to marshal broadcast message", "error", err)
		return
	}
	l.Debug("broadcasting", "type", msg.Type)
	h.broadcast <- data
}

func (h *Hub) BroadcastTo(client *WSClient, msg WSMessage) {
	l := logger.L.With("component", "ws_hub")
	data, err := json.Marshal(msg)
	if err != nil {
		l.Error("failed to marshal message", "error", err)
		return
	}
	l.Debug("sending direct message", "type", msg.Type)
	select {
	case client.send <- data:
	default:
		h.mu.Lock()
		delete(h.clients, client)
		close(client.send)
		h.mu.Unlock()
		l.Warn("client send buffer full, dropping client")
	}
}

func (c *WSClient) readPump() {
	l := logger.L.With("component", "ws_read_pump")
	l.Debug("read pump started")

	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
		l.Debug("read pump stopped")
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				l.Warn("websocket read error", "error", err)
			} else {
				l.Debug("websocket connection closed", "reason", err.Error())
			}
			break
		}

		var msg WSMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			l.Warn("failed to parse incoming websocket message", "error", err, "raw", preview(string(message), 200))
			c.hub.BroadcastTo(c, WSMessage{
				Type: WSTypeError,
				Data: map[string]any{"message": "invalid message format"},
			})
			continue
		}

		l.Debug("received message", "type", msg.Type)

		if c.hub.OnCommand != nil {
			c.hub.OnCommand(c, msg)
		}
	}
}

func (c *WSClient) writePump() {
	l := logger.L.With("component", "ws_write_pump")
	l.Debug("write pump started")

	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
		l.Debug("write pump stopped")
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				l.Warn("websocket write error", "error", err)
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				l.Warn("websocket ping error", "error", err)
				return
			}
		}
	}
}
