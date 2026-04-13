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
	baseQuery := fmt.Sprintf("vendorId=%s&businessTypes=rocketGrowth&maxPerPage=100", c.VendorID)

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

// requestWithRetry makes an API request with automatic retry on 429
func (c *Client) requestWithRetry(method, path, query string) ([]byte, error) {
	const maxRetries = 3
	for attempt := 0; attempt < maxRetries; attempt++ {
		if attempt > 0 {
			// 재시도 전 대기: 1회차 3초, 2회차 6초
			time.Sleep(time.Duration(attempt*3) * time.Second)
		}
		body, err := c.Request(method, path, query)
		if err != nil {
			if strings.Contains(err.Error(), "429") && attempt < maxRetries-1 {
				continue
			}
			return nil, err
		}
		return body, nil
	}
	return nil, fmt.Errorf("max retries exceeded")
}

// GetOrders fetches all orders by splitting date range into 30-day chunks (API limit)
func (c *Client) GetOrders(paidDateFrom, paidDateTo string) ([]byte, error) {
	// KST 기준으로 날짜 파싱 (쿠팡 API는 KST 기준 날짜 처리)
	kst, _ := time.LoadLocation("Asia/Seoul")
	fromDate, err := time.ParseInLocation("2006-01-02", paidDateFrom, kst)
	if err != nil {
		return nil, fmt.Errorf("invalid paidDateFrom format: %w", err)
	}
	toDate, err := time.ParseInLocation("2006-01-02", paidDateTo, kst)
	if err != nil {
		return nil, fmt.Errorf("invalid paidDateTo format: %w", err)
	}

	// Coupang API treats "to" date as exclusive, so add 1 day to include it
	toDate = toDate.AddDate(0, 0, 1)

	var allOrders []json.RawMessage
	path := fmt.Sprintf("/v2/providers/rg_open_api/apis/api/v1/vendors/%s/rg/orders", c.VendorID)

	// Split into 30-day chunks (API limit: 1 month)
	currentFrom := fromDate
	chunkIndex := 0
	for currentFrom.Before(toDate) {
		// 청크 간 딜레이 (첫 번째 청크는 제외)
		if chunkIndex > 0 {
			time.Sleep(1 * time.Second)
		}
		chunkIndex++

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
		pageIndex := 0
		for {
			// 페이지 간 딜레이 (첫 번째 페이지는 제외)
			if pageIndex > 0 {
				time.Sleep(500 * time.Millisecond)
			}
			pageIndex++

			query := baseQuery
			if nextToken != "" {
				query += "&nextToken=" + nextToken
			}

			body, err := c.requestWithRetry("GET", path, query)
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
		currentFrom = currentTo
	}

	// Build combined response
	result := map[string]interface{}{
		"code":    "SUCCESS",
		"message": "",
		"data":    allOrders,
	}
	return json.Marshal(result)
}

// GetProductDetail fetches a single product with full item (option) details
func (c *Client) GetProductDetail(sellerProductId int64) ([]byte, error) {
	path := fmt.Sprintf("/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/%d", sellerProductId)
	return c.Request("GET", path, fmt.Sprintf("vendorId=%s", c.VendorID))
}

// GetInventory fetches inventory for a specific vendorItemId
func (c *Client) GetInventory(vendorItemId string) ([]byte, error) {
	path := fmt.Sprintf("/v2/providers/openapi/apis/api/v4/vendors/%s/inventories/%s", c.VendorID, vendorItemId)
	return c.Request("GET", path, "")
}

// GetInventorySummaries fetches ALL inventory summaries from Rocket Warehouse (with pagination)
func (c *Client) GetInventorySummaries() ([]json.RawMessage, error) {
	path := fmt.Sprintf("/v2/providers/rg_open_api/apis/api/v1/vendors/%s/rg/inventory/summaries", c.VendorID)

	type invPage struct {
		Message   string            `json:"message"`
		NextToken string            `json:"nextToken"`
		Data      []json.RawMessage `json:"data"`
	}

	var allItems []json.RawMessage
	nextToken := ""

	for {
		query := ""
		if nextToken != "" {
			query = "nextToken=" + nextToken
		}

		body, err := c.Request("GET", path, query)
		if err != nil {
			return nil, err
		}

		var page invPage
		if err := json.Unmarshal(body, &page); err != nil {
			return nil, fmt.Errorf("failed to parse inventory summaries: %w", err)
		}

		allItems = append(allItems, page.Data...)

		if page.NextToken == "" {
			break
		}
		nextToken = page.NextToken
	}

	return allItems, nil
}