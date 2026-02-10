package coupang

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"time"
)

type Client struct {
	AccessKey string
	SecretKey string
	BaseURL   string
	HTTPClient *http.Client
}

func NewClient(accessKey, secretKey string) *Client {
	return &Client{
		AccessKey: accessKey,
		SecretKey: secretKey,
		BaseURL:   "https://api-gateway.coupang.com",
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// GenerateHMACSignature generates HMAC-SHA256 signature for Coupang API
func (c *Client) GenerateHMACSignature(method, path, query string) string {
	timestamp := time.Now().UTC().Format("060102T150405Z")
	message := fmt.Sprintf("%s %s\n%s\n%s", timestamp, method, path, query)

	h := hmac.New(sha256.New, []byte(c.SecretKey))
	h.Write([]byte(message))

	return hex.EncodeToString(h.Sum(nil))
}

// Request makes authenticated request to Coupang API
func (c *Client) Request(method, path, query string) ([]byte, error) {
	url := c.BaseURL + path
	if query != "" {
		url += "?" + query
	}

	req, err := http.NewRequest(method, url, nil)
	if err != nil {
		return nil, err
	}

	// Add headers
	timestamp := time.Now().UTC().Format("060102T150405Z")
	signature := c.GenerateHMACSignature(method, path, query)

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("CEA algorithm=HmacSHA256, access-key=%s, signed-date=%s, signature=%s",
		c.AccessKey, timestamp, signature))

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("coupang API error: %d - %s", resp.StatusCode, string(body))
	}

	return body, nil
}

// GetProducts fetches product list
func (c *Client) GetProducts() ([]byte, error) {
	return c.Request("GET", "/v2/providers/seller_api/apis/api/v1/marketplace/seller-products", "")
}

// GetOrders fetches order list
func (c *Client) GetOrders(createdAtFrom, createdAtTo string) ([]byte, error) {
	query := fmt.Sprintf("createdAtFrom=%s&createdAtTo=%s", createdAtFrom, createdAtTo)
	return c.Request("GET", "/v2/providers/openapi/apis/api/v4/vendors/openapi/orders", query)
}