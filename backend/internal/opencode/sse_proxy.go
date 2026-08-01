package opencode

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"

	"your-junior/internal/logger"
)

var thinkingTagRe = regexp.MustCompile(`(?s)<think>.*?</think>\s*`)

func stripThinkingTags(s string) string {
	return thinkingTagRe.ReplaceAllString(s, "")
}

func getMapKeys(m map[string]any) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

type SSEEvent struct {
	Event   string          `json:"event"`
	Data    json.RawMessage `json:"data"`
	RawData string          `json:"-"`
}

type SSEProxy struct {
	manager         *Manager
	hub             *Hub
	cancel          chan struct{}
	partAccText     map[string]string
	partAccReasoning map[string]string // partID -> accumulated reasoning text
	messageRoles    map[string]string // messageID -> role
	partTypes       map[string]string // partID -> type (text, reasoning, etc.)
	partToMessage   map[string]string // partID -> messageID
}

func NewSSEProxy(manager *Manager, hub *Hub) *SSEProxy {
	return &SSEProxy{
		manager:         manager,
		hub:             hub,
		cancel:          make(chan struct{}),
		partAccText:     make(map[string]string),
		partAccReasoning: make(map[string]string),
		messageRoles:    make(map[string]string),
		partTypes:       make(map[string]string),
		partToMessage:   make(map[string]string),
	}
}

func (p *SSEProxy) Start() {
	l := logger.L.With("component", "sse_proxy")
	url := p.manager.GetBaseURL() + "/event"
	l.Info("starting SSE proxy", "url", url)

	go func() {
		for {
			select {
			case <-p.cancel:
				l.Debug("SSE proxy stopped")
				return
			default:
				if err := p.connect(url); err != nil {
					l.Warn("SSE connection failed, retrying", "error", err)
				}
				select {
				case <-p.cancel:
					l.Debug("SSE proxy stopped after reconnect")
					return
				default:
				}
			}
		}
	}()
}

func (p *SSEProxy) Stop() {
	close(p.cancel)
}

func (p *SSEProxy) clearPartAcc() {
	p.partAccText = make(map[string]string)
	p.partAccReasoning = make(map[string]string)
	p.messageRoles = make(map[string]string)
	p.partTypes = make(map[string]string)
	p.partToMessage = make(map[string]string)
}

func (p *SSEProxy) getTextForMessage(messageID string) string {
	for partID, text := range p.partAccText {
		if p.partToMessage[partID] == messageID {
			return text
		}
	}
	return ""
}

func (p *SSEProxy) getReasoningForMessage(messageID string) string {
	var result string
	for partID, text := range p.partAccReasoning {
		if p.partToMessage[partID] == messageID {
			result += text
		}
	}
	return result
}

func (p *SSEProxy) connect(url string) error {
	l := logger.L.With("component", "sse_proxy")

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create SSE request: %w", err)
	}
	req.Header.Set("Accept", "text/event-stream")
	req.Header.Set("Cache-Control", "no-cache")

	l.Debug("connecting to SSE stream", "url", url)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		l.Warn("SSE request failed", "error", err)
		return fmt.Errorf("SSE request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		l.Warn("SSE returned non-OK status", "status", resp.StatusCode)
		return fmt.Errorf("SSE returned status %d", resp.StatusCode)
	}

	l.Info("connected to opencode SSE event stream")

	reader := bufio.NewReader(resp.Body)
	var eventType string
	var sb strings.Builder

	for {
		select {
		case <-p.cancel:
			return nil
		default:
		}

		line, err := reader.ReadString('\n')
		if err != nil {
			l.Warn("SSE read error, will reconnect", "error", err)
			return fmt.Errorf("SSE read error: %w", err)
		}

		line = strings.TrimRight(line, "\r\n")

		if strings.HasPrefix(line, "event:") {
			eventType = strings.TrimSpace(strings.TrimPrefix(line, "event:"))
			continue
		}

		if strings.HasPrefix(line, "data:") {
			data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
			sb.WriteString(data)
			continue
		}

		if line == "" && sb.Len() > 0 {
			p.handleEvent(eventType, sb.String(), p.extractTypeFromJSON(sb.String()))
			sb.Reset()
			eventType = ""
		}
	}
}

func (p *SSEProxy) extractTypeFromJSON(rawData string) string {
	if rawData == "" {
		return ""
	}
	var data map[string]any
	if err := json.Unmarshal([]byte(rawData), &data); err != nil {
		return ""
	}
	t, _ := data["type"].(string)
	return t
}

func (p *SSEProxy) handleEvent(eventType, rawData, jsonType string) {
	if eventType == "" && jsonType != "" {
		eventType = jsonType
	}
	l := logger.L.With("component", "sse_proxy", "event_type", eventType)

	switch eventType {
	case "message.part.delta":
		l.Debug("received SSE event", "data_len", len(rawData))
		var data map[string]any
		if err := json.Unmarshal([]byte(rawData), &data); err != nil {
			l.Warn("failed to parse message.part.delta", "error", err)
			return
		}
		props, _ := data["properties"].(map[string]any)
		if props == nil {
			return
		}
		partID, _ := props["partID"].(string)
		delta, _ := props["delta"].(string)
		partType, _ := props["type"].(string)
		messageID, _ := props["messageID"].(string)

		if partID == "" {
			partID = "_default"
		}

		// Look up messageID from partToMessage if not in properties
		if messageID == "" {
			messageID = p.partToMessage[partID]
		}

		// Look up part type from stored data if not in properties
		if partType == "" {
			partType = p.partTypes[partID]
		}

		l.Debug("part.delta details", "partID", partID, "type", partType, "messageID", messageID, "delta_preview", delta[:min(len(delta), 50)])

		if delta == "" {
			return
		}

		// Skip non-assistant messages
		if messageID != "" && p.messageRoles[messageID] != "assistant" {
			l.Debug("skipping non-assistant message part delta", "messageID", messageID, "role", p.messageRoles[messageID])
			return
		}

		if partType == "reasoning" {
			p.partAccReasoning[partID] += delta
			// Find the text part for this message to send reasoning alongside
			textContent := p.getTextForMessage(messageID)
			p.hub.Broadcast(WSMessage{
				Type: WSTypeChatMessage,
				Data: map[string]any{
					"event":     eventType,
					"text":      textContent,
					"reasoning": p.partAccReasoning[partID],
					"streaming": true,
				},
			})
			return
		}

		if partType != "text" {
			return
		}

		p.partAccText[partID] += delta
		reasoningContent := p.getReasoningForMessage(messageID)
		p.hub.Broadcast(WSMessage{
			Type: WSTypeChatMessage,
			Data: map[string]any{
				"event":     eventType,
				"text":      stripThinkingTags(p.partAccText[partID]),
				"reasoning": reasoningContent,
				"streaming": true,
			},
		})

	case "message.part.updated":
		l.Debug("received SSE event", "data_len", len(rawData))
		var data map[string]any
		if err := json.Unmarshal([]byte(rawData), &data); err != nil {
			l.Warn("failed to parse message.part.updated", "error", err)
			return
		}
		props, _ := data["properties"].(map[string]any)
		if props == nil {
			return
		}
		part, _ := props["part"].(map[string]any)
		if part == nil {
			return
		}
		partType, _ := part["type"].(string)
		partID, _ := part["id"].(string)
		messageID, _ := part["messageID"].(string)
		l.Debug("part.updated details", "partID", partID, "type", partType, "messageID", messageID, "keys", getMapKeys(part))

		if partID == "" {
			partID = "_default"
		}

		// Track part type and message mapping
		if partType != "" {
			p.partTypes[partID] = partType
		}
		if messageID != "" {
			p.partToMessage[partID] = messageID
		}

		// Skip non-assistant messages
		if messageID != "" && p.messageRoles[messageID] != "assistant" {
			l.Debug("skipping non-assistant message part update", "messageID", messageID, "role", p.messageRoles[messageID])
			return
		}

		text, _ := part["text"].(string)
		snapshot, _ := part["snapshot"].(string)
		content := text
		if content == "" {
			content = snapshot
		}

		if partType == "reasoning" {
			if content != "" {
				p.partAccReasoning[partID] = content
				textContent := p.getTextForMessage(messageID)
				p.hub.Broadcast(WSMessage{
					Type: WSTypeChatMessage,
					Data: map[string]any{
						"event":     eventType,
						"text":      textContent,
						"reasoning": content,
						"streaming": true,
					},
				})
			}
			return
		}

		if partType != "text" {
			l.Debug("skipping non-text part type", "partID", partID, "type", partType)
			return
		}

		if content != "" {
			p.partAccText[partID] = content
			reasoningContent := p.getReasoningForMessage(messageID)
			p.hub.Broadcast(WSMessage{
				Type: WSTypeChatMessage,
				Data: map[string]any{
					"event":     eventType,
					"text":      stripThinkingTags(content),
					"reasoning": reasoningContent,
					"streaming": true,
				},
			})
		}

	case "message.updated":
		l.Debug("received SSE event", "data_len", len(rawData))
		var data map[string]any
		if err := json.Unmarshal([]byte(rawData), &data); err != nil {
			l.Warn("failed to parse message.updated", "error", err)
			return
		}
		props, _ := data["properties"].(map[string]any)
		if props == nil {
			return
		}
		info, _ := props["info"].(map[string]any)
		if info == nil {
			return
		}
		role, _ := info["role"].(string)
		messageID, _ := info["id"].(string)
		parts, _ := info["parts"].([]any)
		l.Debug("message.updated details", "role", role, "messageID", messageID, "parts_count", len(parts))

		// Track message role
		if messageID != "" && role != "" {
			p.messageRoles[messageID] = role
		}

		// Track part types from this message
		for _, pt := range parts {
			part, ok := pt.(map[string]any)
			if !ok {
				continue
			}
			partID, _ := part["id"].(string)
			partType, _ := part["type"].(string)
			if partID != "" && partType != "" {
				p.partTypes[partID] = partType
				if messageID != "" {
					p.partToMessage[partID] = messageID
				}
			}
		}

		var content string
		var partID string
		var reasoningContent string
		for _, pt := range parts {
			part, ok := pt.(map[string]any)
			if !ok {
				continue
			}
			partType, _ := part["type"].(string)
			l.Debug("message.updated part", "type", partType, "keys", getMapKeys(part))

			if partType == "reasoning" {
				text, _ := part["text"].(string)
				snapshot, _ := part["snapshot"].(string)
				r := text
				if r == "" {
					r = snapshot
				}
				if r != "" {
					reasoningContent += r
					rPartID, _ := part["id"].(string)
					if rPartID != "" {
						p.partAccReasoning[rPartID] = r
					}
				}
				continue
			}

			// Only use text parts
			if partType != "text" {
				continue
			}
			partID, _ = part["id"].(string)
			text, _ := part["text"].(string)
			snapshot, _ := part["snapshot"].(string)
			content = text
			if content == "" {
				content = snapshot
			}
			if content != "" {
				break
			}
		}

		if role == "assistant" && content != "" {
			if partID == "" {
				partID = "_default"
			}
			p.partAccText[partID] = content
			if reasoningContent == "" {
				reasoningContent = p.getReasoningForMessage(messageID)
			}
			p.hub.Broadcast(WSMessage{
				Type: WSTypeChatMessage,
				Data: map[string]any{
					"event":     eventType,
					"text":      stripThinkingTags(content),
					"reasoning": reasoningContent,
					"streaming": true,
				},
			})
		}

	case "message.completed":
		l.Debug("received SSE event", "data_len", len(rawData))
		p.clearPartAcc()
		var data map[string]any
		jsonErr := json.Unmarshal([]byte(rawData), &data)
		if jsonErr == nil {
			p.hub.Broadcast(WSMessage{
				Type: WSTypeChatComplete,
				Data: data,
			})
		} else {
			l.Warn("failed to parse completed message", "error", jsonErr)
		}

	case "session.updated":
		l.Debug("received SSE event", "data_len", len(rawData))
		var data map[string]any
		if err := json.Unmarshal([]byte(rawData), &data); err == nil {
			p.hub.Broadcast(WSMessage{
				Type: WSTypeServerStatus,
				Data: data,
			})
		} else {
			l.Debug("failed to parse session.updated data", "error", err)
		}

	case "session.idle":
		l.Debug("received SSE event", "data_len", len(rawData))
		p.clearPartAcc()
		p.hub.Broadcast(WSMessage{
			Type: WSTypeChatComplete,
			Data: map[string]any{"event": eventType},
		})

	case "session.status":
		l.Debug("received SSE event", "data_len", len(rawData))
		var data map[string]any
		if err := json.Unmarshal([]byte(rawData), &data); err == nil {
			props, _ := data["properties"].(map[string]any)
			if props != nil {
				statusObj, _ := props["status"].(map[string]any)
				if statusObj != nil {
					statusType, _ := statusObj["type"].(string)
					p.hub.Broadcast(WSMessage{
						Type: WSTypeServerStatus,
						Data: map[string]any{
							"event":     eventType,
							"status":    statusType,
							"raw":       rawData,
						},
					})
				}
			}
		}

	default:
		l.Debug("unhandled SSE event", "raw_preview", rawData[:min(len(rawData), 200)])
	}
}
