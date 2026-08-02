package opencode

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"your-junior/internal/logger"
)

type Client struct {
	baseURL    string
	httpClient *http.Client
}

type SessionResponse struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	CreatedAt string `json:"created_at"`
	ParentID  string `json:"parent_id,omitempty"`
}

type Part struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type MessageResponse struct {
	ID     string `json:"id"`
	Role   string `json:"role"`
	Text   string `json:"text"`
	Status string `json:"status"`
}

type MessageListEntry struct {
	Info  MessageInfo   `json:"info"`
	Parts []MessagePart `json:"parts"`
}

type MessageInfo struct {
	ID        string `json:"id"`
	Role      string `json:"role"`
	Text      string `json:"text"`
	SessionID string `json:"sessionID"`
}

type MessagePart struct {
	ID        string         `json:"id"`
	Type      string         `json:"type"`
	Text      string         `json:"text,omitempty"`
	Tool      string         `json:"tool,omitempty"`
	CallID    string         `json:"callID,omitempty"`
	MessageID string         `json:"messageID"`
	SessionID string         `json:"sessionID"`
	State     map[string]any `json:"state,omitempty"`
}

type ProviderResponse struct {
	Providers []Provider `json:"providers"`
}

type Provider struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type ProviderListItem struct {
	ID     string               `json:"id"`
	Name   string               `json:"name"`
	Api    string               `json:"api"`
	Env    []string             `json:"env"`
	Models map[string]ModelInfo `json:"models"`
}

type ProviderListResponse struct {
	All       []ProviderListItem  `json:"all"`
	Default   map[string]string   `json:"default"`
	Connected []string            `json:"connected"`
}

type ModelInfo struct {
	ID          string                   `json:"id"`
	Name        string                   `json:"name"`
	ProviderID  string                   `json:"provider_id"`
	Cost        *ModelCost               `json:"cost,omitempty"`
	Variants    map[string]any           `json:"variants,omitempty"`
	ReleaseDate string                   `json:"release_date,omitempty"`
	Status      string                   `json:"status,omitempty"`
	Capabilities *ModelCapabilities      `json:"capabilities,omitempty"`
}

type ModelCost struct {
	Input  float64 `json:"input"`
	Output float64 `json:"output"`
}

type ModelCapabilities struct {
	Reasoning bool `json:"reasoning"`
}

type ProvidersConfigResponse struct {
	Providers []ProviderConfig `json:"providers"`
	Default   map[string]string `json:"default"`
}

type ProviderConfig struct {
	ID     string               `json:"id"`
	Name   string               `json:"name"`
	Models map[string]ModelInfo `json:"models"`
}

type ConfigPayload struct {
	Model string `json:"model,omitempty"`
}

func NewClient(baseURL string) *Client {
	logger.L.Info("creating opencode HTTP client", "base_url", baseURL)
	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (c *Client) CreateSession(title string) (*SessionResponse, error) {
	l := logger.L.With("component", "opencode_client", "method", "CreateSession")
	body := map[string]string{
		"title": title,
	}
	jsonBody, _ := json.Marshal(body)

	url := c.baseURL + "/session"
	l.Debug("sending request", "url", url, "title", title)

	resp, err := c.httpClient.Post(url, "application/json", bytes.NewReader(jsonBody))
	if err != nil {
		l.Error("request failed", "error", err)
		return nil, fmt.Errorf("create session request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		bodyBytes, _ := io.ReadAll(resp.Body)
		l.Error("non-OK response", "status", resp.StatusCode, "body", string(bodyBytes))
		return nil, fmt.Errorf("create session returned %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var session SessionResponse
	if err := json.NewDecoder(resp.Body).Decode(&session); err != nil {
		l.Error("failed to decode response", "error", err)
		return nil, fmt.Errorf("failed to decode session response: %w", err)
	}

	l.Info("session created", "session_id", session.ID)
	return &session, nil
}

func (c *Client) SendMessage(sessionID, text string) (*MessageResponse, error) {
	l := logger.L.With("component", "opencode_client", "method", "SendMessage")
	body := map[string]any{
		"parts": []Part{{Type: "text", Text: text}},
	}
	jsonBody, _ := json.Marshal(body)

	url := fmt.Sprintf("%s/session/%s/message", c.baseURL, sessionID)
	l.Debug("sending request", "url", url, "text_len", len(text))

	resp, err := c.httpClient.Post(url, "application/json", bytes.NewReader(jsonBody))
	if err != nil {
		l.Error("request failed", "error", err)
		return nil, fmt.Errorf("send message request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		bodyBytes, _ := io.ReadAll(resp.Body)
		l.Error("non-OK response", "status", resp.StatusCode, "body", string(bodyBytes))
		return nil, fmt.Errorf("send message returned %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var msg MessageResponse
	if err := json.NewDecoder(resp.Body).Decode(&msg); err != nil {
		l.Error("failed to decode response", "error", err)
		return nil, fmt.Errorf("failed to decode message response: %w", err)
	}

	l.Info("message sent", "msg_id", msg.ID, "status", msg.Status)
	return &msg, nil
}

func (c *Client) SendPromptAsync(sessionID, text string) error {
	l := logger.L.With("component", "opencode_client", "method", "SendPromptAsync")
	body := map[string]any{
		"parts": []Part{{Type: "text", Text: text}},
	}
	jsonBody, _ := json.Marshal(body)

	url := fmt.Sprintf("%s/session/%s/prompt_async", c.baseURL, sessionID)
	l.Debug("sending request", "url", url, "session_id", sessionID, "text_len", len(text))

	resp, err := c.httpClient.Post(url, "application/json", bytes.NewReader(jsonBody))
	if err != nil {
		l.Error("request failed", "error", err)
		return fmt.Errorf("send prompt async request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusAccepted && resp.StatusCode != http.StatusNoContent {
		bodyBytes, _ := io.ReadAll(resp.Body)
		l.Error("non-OK response", "status", resp.StatusCode, "body", string(bodyBytes))
		return fmt.Errorf("send prompt async returned %d: %s", resp.StatusCode, string(bodyBytes))
	}

	l.Info("prompt sent async", "session_id", sessionID, "text_len", len(text))
	return nil
}

func (c *Client) ListMessages(sessionID string) ([]MessageListEntry, error) {
	l := logger.L.With("component", "opencode_client", "method", "ListMessages")
	url := fmt.Sprintf("%s/session/%s/message", c.baseURL, sessionID)
	l.Debug("sending request", "url", url)

	resp, err := c.httpClient.Get(url)
	if err != nil {
		l.Error("request failed", "error", err)
		return nil, fmt.Errorf("list messages request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		l.Error("non-OK response", "status", resp.StatusCode, "body", string(bodyBytes))
		return nil, fmt.Errorf("list messages returned %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var entries []MessageListEntry
	if err := json.NewDecoder(resp.Body).Decode(&entries); err != nil {
		l.Error("failed to decode response", "error", err)
		return nil, fmt.Errorf("failed to decode messages response: %w", err)
	}

	l.Debug("messages listed", "count", len(entries))
	return entries, nil
}

func (c *Client) GetProviders() ([]Provider, error) {
	l := logger.L.With("component", "opencode_client", "method", "GetProviders")
	resp, err := c.httpClient.Get(c.baseURL + "/provider")
	if err != nil {
		l.Error("request failed", "error", err)
		return nil, fmt.Errorf("get providers request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		l.Error("non-OK response", "status", resp.StatusCode, "body", string(bodyBytes))
		return nil, fmt.Errorf("get providers returned %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var providerResp ProviderResponse
	if err := json.NewDecoder(resp.Body).Decode(&providerResp); err != nil {
		l.Error("failed to decode response", "error", err)
		return nil, fmt.Errorf("failed to decode providers response: %w", err)
	}

	l.Debug("providers fetched", "count", len(providerResp.Providers))
	return providerResp.Providers, nil
}

func (c *Client) GetProviderList() (*ProviderListResponse, error) {
	l := logger.L.With("component", "opencode_client", "method", "GetProviderList")
	resp, err := c.httpClient.Get(c.baseURL + "/provider")
	if err != nil {
		l.Error("request failed", "error", err)
		return nil, fmt.Errorf("get provider list request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		l.Error("non-OK response", "status", resp.StatusCode, "body", string(bodyBytes))
		return nil, fmt.Errorf("get provider list returned %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var result ProviderListResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		l.Error("failed to decode response", "error", err)
		return nil, fmt.Errorf("failed to decode provider list response: %w", err)
	}

	l.Debug("provider list fetched", "all_count", len(result.All), "connected_count", len(result.Connected))
	return &result, nil
}

func (c *Client) GetProvidersConfig() (*ProvidersConfigResponse, error) {
	l := logger.L.With("component", "opencode_client", "method", "GetProvidersConfig")
	resp, err := c.httpClient.Get(c.baseURL + "/config/providers")
	if err != nil {
		l.Error("request failed", "error", err)
		return nil, fmt.Errorf("get providers config request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		l.Error("non-OK response", "status", resp.StatusCode, "body", string(bodyBytes))
		return nil, fmt.Errorf("get providers config returned %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var result ProvidersConfigResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		l.Error("failed to decode response", "error", err)
		return nil, fmt.Errorf("failed to decode providers config response: %w", err)
	}

	l.Debug("providers config fetched", "count", len(result.Providers))
	return &result, nil
}

func (c *Client) SetConfig(payload ConfigPayload) error {
	l := logger.L.With("component", "opencode_client", "method", "SetConfig")
	jsonBody, _ := json.Marshal(payload)

	url := c.baseURL + "/config"
	l.Debug("sending request", "url", url, "payload", string(jsonBody))

	req, err := http.NewRequest(http.MethodPatch, url, bytes.NewReader(jsonBody))
	if err != nil {
		return fmt.Errorf("create set config request failed: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		l.Error("request failed", "error", err)
		return fmt.Errorf("set config request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		l.Error("non-OK response", "status", resp.StatusCode, "body", string(bodyBytes))
		return fmt.Errorf("set config returned %d: %s", resp.StatusCode, string(bodyBytes))
	}

	l.Info("config updated")
	return nil
}

func (c *Client) DisposeInstance() error {
	l := logger.L.With("component", "opencode_client", "method", "DisposeInstance")
	url := c.baseURL + "/instance/dispose"
	l.Debug("sending request", "url", url)

	resp, err := c.httpClient.Post(url, "application/json", nil)
	if err != nil {
		l.Error("request failed", "error", err)
		return fmt.Errorf("dispose instance request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		l.Error("non-OK response", "status", resp.StatusCode, "body", string(bodyBytes))
		return fmt.Errorf("dispose instance returned %d: %s", resp.StatusCode, string(bodyBytes))
	}

	l.Info("instance disposed")
	return nil
}

func (c *Client) SetAuth(providerID, apiKey string) error {
	l := logger.L.With("component", "opencode_client", "method", "SetAuth")
	body := map[string]any{
		"auth": map[string]any{
			"type": "api",
			"key":  apiKey,
		},
	}
	jsonBody, _ := json.Marshal(body)

	url := fmt.Sprintf("%s/auth/%s", c.baseURL, providerID)
	l.Debug("sending request", "url", url)

	req, err := http.NewRequest(http.MethodPut, url, bytes.NewReader(jsonBody))
	if err != nil {
		return fmt.Errorf("create set auth request failed: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		l.Error("request failed", "error", err)
		return fmt.Errorf("set auth request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		l.Error("non-OK response", "status", resp.StatusCode, "body", string(bodyBytes))
		return fmt.Errorf("set auth returned %d: %s", resp.StatusCode, string(bodyBytes))
	}

	l.Info("auth set", "provider", providerID)
	return nil
}

func (c *Client) AbortSession(sessionID string) error {
	l := logger.L.With("component", "opencode_client", "method", "AbortSession")
	url := fmt.Sprintf("%s/session/%s/abort", c.baseURL, sessionID)
	l.Debug("sending request", "url", url)

	resp, err := c.httpClient.Post(url, "application/json", nil)
	if err != nil {
		l.Error("request failed", "error", err)
		return fmt.Errorf("abort session request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		l.Error("non-OK response", "status", resp.StatusCode, "body", string(bodyBytes))
		return fmt.Errorf("abort session returned %d: %s", resp.StatusCode, string(bodyBytes))
	}

	l.Info("session aborted", "session_id", sessionID)
	return nil
}

func (c *Client) ListSessions() ([]SessionResponse, error) {
	l := logger.L.With("component", "opencode_client", "method", "ListSessions")
	url := c.baseURL + "/session"
	l.Debug("sending request", "url", url)

	resp, err := c.httpClient.Get(url)
	if err != nil {
		l.Error("request failed", "error", err)
		return nil, fmt.Errorf("list sessions request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		l.Error("non-OK response", "status", resp.StatusCode, "body", string(bodyBytes))
		return nil, fmt.Errorf("list sessions returned %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var sessions []SessionResponse
	if err := json.NewDecoder(resp.Body).Decode(&sessions); err != nil {
		l.Error("failed to decode response", "error", err)
		return nil, fmt.Errorf("failed to decode sessions response: %w", err)
	}

	l.Info("sessions listed", "count", len(sessions))
	return sessions, nil
}
