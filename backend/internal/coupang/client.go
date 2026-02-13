package coupang

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type productsPage struct {
	Code      string            `json:"code"`
	Message   string            `json:"message"`
	NextToken string            `json:"nextToken"`
	Data      []json.RawMessage `json:"data"`
}

type Client struct {
	VendorID  string
	AccessKey string
	SecretKey string
	BaseURL   string
	HTTPClient *http.Client
}

func NewClient(vendorID, accessKey, secretKey string) *Client {
	return &Client{
		VendorID:  vendorID,
		AccessKey: accessKey,
		SecretKey: secretKey,
		BaseURL:   "https://api-gateway.coupang.com",
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// GenerateHMACSignature generates HMAC-SHA256 signature for Coupang API
func (c *Client) GenerateHMACSignature(method, path, query, timestamp string) string {
	// Format: {datetime}{method}{path}{query} (no spaces)
	message := fmt.Sprintf("%s%s%s%s", timestamp, method, path, query)

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

	// Add headers - use same timestamp for both signature and header
	timestamp := time.Now().UTC().Format("060102T150405Z")
	signature := c.GenerateHMACSignature(method, path, query, timestamp)

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

// GetProducts fetches all products by following nextToken pagination
func (c *Client) GetProducts() ([]byte, error) {
	path := "/v2/providers/seller_api/apis/api/v1/marketplace/seller-products"
	baseQuery := fmt.Sprintf("vendorId=%s&businessTypes=rocketGrowth", c.VendorID)

	var allProducts []json.RawMessage

	nextToken := ""
	for {
		query := baseQuery
		if nextToken != "" {
			query += "&nextToken=" + nextToken
		}

		body, err := c.Request("GET", path, query)
		if err != nil {
			return nil, err
		}

		var page productsPage
		if err := json.Unmarshal(body, &page); err != nil {
			return nil, fmt.Errorf("failed to parse products response: %w", err)
		}

		allProducts = append(allProducts, page.Data...)

		if page.NextToken == "" {
			break
		}
		nextToken = page.NextToken
	}

	// Build combined response
	result := map[string]interface{}{
		"code":    "SUCCESS",
		"message": "",
		"data":    allProducts,
	}
	return json.Marshal(result)
}

// ordersPage represents a paginated response from Orders API
type ordersPage struct {
	Code      interface{}       `json:"code"` // Can be string or number depending on API
	Message   string            `json:"message"`
	NextToken string            `json:"nextToken"`
	Data      []json.RawMessage `json:"data"`
}

// GetOrders fetches all orders by splitting date range into 30-day chunks (API limit)
func (c *Client) GetOrders(paidDateFrom, paidDateTo string) ([]byte, error) {
	// Parse date strings
	fromDate, err := time.Parse("2006-01-02", paidDateFrom)
	if err != nil {
		return nil, fmt.Errorf("invalid paidDateFrom format: %w", err)
	}
	toDate, err := time.Parse("2006-01-02", paidDateTo)
	if err != nil {
		return nil, fmt.Errorf("invalid paidDateTo format: %w", err)
	}

	// Coupang API treats "to" date as exclusive, so add 1 day to include it
	toDate = toDate.AddDate(0, 0, 1)

	var allOrders []json.RawMessage
	path := fmt.Sprintf("/v2/providers/rg_open_api/apis/api/v1/vendors/%s/rg/orders", c.VendorID)

	// Split into 30-day chunks (API limit: 1 month)
	currentFrom := fromDate
	for currentFrom.Before(toDate) || currentFrom.Equal(toDate) {
		// Calculate chunk end (30 days from current start, but not exceeding toDate)
		currentTo := currentFrom.AddDate(0, 0, 30)
		if currentTo.After(toDate) {
			currentTo = toDate
		}

		// Convert to yyyymmdd format
		fromStr := strings.ReplaceAll(currentFrom.Format("2006-01-02"), "-", "")
		toStr := strings.ReplaceAll(currentTo.Format("2006-01-02"), "-", "")

		// Fetch orders for this chunk with pagination
		baseQuery := fmt.Sprintf("paidDateFrom=%s&paidDateTo=%s", fromStr, toStr)
		nextToken := ""
		for {
			query := baseQuery
			if nextToken != "" {
				query += "&nextToken=" + nextToken
			}

			body, err := c.Request("GET", path, query)
			if err != nil {
				return nil, err
			}

			var page ordersPage
			if err := json.Unmarshal(body, &page); err != nil {
				return nil, fmt.Errorf("failed to parse orders response: %w", err)
			}

			allOrders = append(allOrders, page.Data...)

			// If no nextToken, we've fetched all pages for this chunk
			if page.NextToken == "" {
				break
			}
			nextToken = page.NextToken
		}

		// Move to next chunk
		currentFrom = currentTo.AddDate(0, 0, 1)
	}

	// Build combined response
	result := map[string]interface{}{
		"code":    "SUCCESS",
		"message": "",
		"data":    allOrders,
	}
	return json.Marshal(result)
}

// GetInventory fetches inventory for a specific vendorItemId
func (c *Client) GetInventory(vendorItemId string) ([]byte, error) {
	path := fmt.Sprintf("/v2/providers/openapi/apis/api/v4/vendors/%s/inventories/%s", c.VendorID, vendorItemId)
	return c.Request("GET", path, "")
}

// GetInventorySummaries fetches ALL inventory summaries from Rocket Warehouse
func (c *Client) GetInventorySummaries() ([]byte, error) {
	path := fmt.Sprintf("/v2/providers/rg_open_api/apis/api/v1/vendors/%s/rg/inventory/summaries", c.VendorID)
	return c.Request("GET", path, "")
}