package opencode

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

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

type ProviderResponse struct {
	Providers []Provider `json:"providers"`
}

type Provider struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

func NewClient(baseURL string) *Client {
	logger.L.Info("creating opencode HTTP client", "base_url", baseURL)
	return &Client{
		baseURL:    baseURL,
		httpClient: &http.Client{},
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

func (c *Client) ListMessages(sessionID string) ([]MessageResponse, error) {
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

	var messages []MessageResponse
	if err := json.NewDecoder(resp.Body).Decode(&messages); err != nil {
		l.Error("failed to decode response", "error", err)
		return nil, fmt.Errorf("failed to decode messages response: %w", err)
	}

	l.Debug("messages listed", "count", len(messages))
	return messages, nil
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
