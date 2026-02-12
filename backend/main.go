package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/labstack/echo/v4"
	echomiddleware "github.com/labstack/echo/v4/middleware"
	"github.com/rocketgrowth/backend/internal/auth"
	"github.com/rocketgrowth/backend/internal/config"
	"github.com/rocketgrowth/backend/internal/coupang"
	"github.com/rocketgrowth/backend/internal/handlers"
	"github.com/rocketgrowth/backend/internal/middleware"
)

var (
	cfg           *config.Config
	coupangClient *coupang.Client
)

func main() {
	// Load configuration
	cfg = config.Load()

	// Initialize Coupang API client
	coupangClient = coupang.NewClient(cfg.CoupangVendorID, cfg.CoupangAccessKey, cfg.CoupangSecretKey)

	e := echo.New()

	// Middleware
	e.Use(echomiddleware.Logger())
	e.Use(echomiddleware.Recover())
	e.Use(echomiddleware.CORS())

	// Public routes (no authentication required)
	e.POST("/api/auth/login", handlers.Login(cfg))
	e.GET("/api/health", healthCheck)

	// Protected routes (JWT authentication required)
	api := e.Group("/api")
	api.Use(middleware.JWTAuthMiddleware(cfg))
	api.GET("/coupang/products", getProductsProtected)
	api.GET("/coupang/orders", getOrdersProtected)
	api.GET("/coupang/inventory", getInventoryProtected)
	api.GET("/coupang/test", testCoupangAPI)

	// Start server
	port := fmt.Sprintf(":%s", cfg.ServerPort)
	e.Logger.Fatal(e.Start(port))
}

func healthCheck(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]interface{}{
		"status":  "ok",
		"message": "RocketGrowth API is running",
		"config": map[string]string{
			"vendor_id": cfg.CoupangVendorID,
			"has_access_key": func() string {
				if cfg.CoupangAccessKey != "" {
					return "yes"
				}
				return "no"
			}(),
		},
	})
}

func testCoupangAPI(c echo.Context) error {
	// Test Coupang API connection
	return c.JSON(http.StatusOK, map[string]string{
		"message": "Coupang API client initialized",
		"vendor_id": cfg.CoupangVendorID,
	})
}

func getProductsProtected(c echo.Context) error {
	// Extract credentials from JWT claims
	claims := c.Get("user_claims").(*auth.Claims)
	client := coupang.NewClient(claims.VendorID, claims.AccessKey, claims.SecretKey)

	data, err := client.GetProducts()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSONBlob(http.StatusOK, data)
}

func getOrdersProtected(c echo.Context) error {
	claims := c.Get("user_claims").(*auth.Claims)
	client := coupang.NewClient(claims.VendorID, claims.AccessKey, claims.SecretKey)

	createdAtFrom := c.QueryParam("createdAtFrom")
	createdAtTo := c.QueryParam("createdAtTo")

	if createdAtFrom == "" || createdAtTo == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "createdAtFrom and createdAtTo query parameters are required",
		})
	}

	data, err := client.GetOrders(createdAtFrom, createdAtTo)
	if err != nil {
		c.Logger().Errorf("GetOrders failed: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSONBlob(http.StatusOK, data)
}

func getInventoryProtected(c echo.Context) error {
	claims := c.Get("user_claims").(*auth.Claims)
	client := coupang.NewClient(claims.VendorID, claims.AccessKey, claims.SecretKey)

	// Step 1: Get recent orders to collect vendorItemIds (last 30 days - API limit)
	toDate := time.Now().Format("2006-01-02")
	fromDate := time.Now().AddDate(0, 0, -30).Format("2006-01-02")

	ordersData, err := client.GetOrders(fromDate, toDate)
	if err != nil {
		c.Logger().Errorf("GetOrders failed: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	var ordersResp struct {
		Code    string `json:"code"`
		Message string `json:"message"`
		Data    []struct {
			OrderId    int64 `json:"orderId"`
			OrderItems []struct {
				VendorItemId int64  `json:"vendorItemId"`
				ProductName  string `json:"productName"`
			} `json:"orderItems"`
		} `json:"data"`
	}
	if err := json.Unmarshal(ordersData, &ordersResp); err != nil {
		c.Logger().Errorf("Failed to parse orders: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to parse orders"})
	}

	// Step 2: Collect unique vendorItemIds and product names from orders
	type ItemInfo struct {
		VendorItemId int64
		ProductName  string
	}
	itemMap := make(map[int64]string) // vendorItemId -> productName

	for _, order := range ordersResp.Data {
		for _, item := range order.OrderItems {
			if item.VendorItemId > 0 {
				itemMap[item.VendorItemId] = item.ProductName
			}
		}
	}

	c.Logger().Infof("Collected %d unique vendorItemIds from orders", len(itemMap))

	if len(itemMap) == 0 {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"code":    "SUCCESS",
			"message": "No items found in recent orders",
			"data":    []interface{}{},
		})
	}

	var items []ItemInfo
	for vendorItemId, productName := range itemMap {
		items = append(items, ItemInfo{
			VendorItemId: vendorItemId,
			ProductName:  productName,
		})
	}

	// Step 3: Fetch inventory for each vendorItemId in parallel using goroutines
	type InventoryResult struct {
		VendorItemId int64
		Data         json.RawMessage
		Err          error
	}

	resultsChan := make(chan InventoryResult, len(items))
	var wg sync.WaitGroup

	for _, item := range items {
		wg.Add(1)
		go func(vendorItemId int64) {
			defer wg.Done()
			invData, err := client.GetInventory(fmt.Sprintf("%d", vendorItemId))
			resultsChan <- InventoryResult{
				VendorItemId: vendorItemId,
				Data:         invData,
				Err:          err,
			}
		}(item.VendorItemId)
	}

	go func() {
		wg.Wait()
		close(resultsChan)
	}()

	// Step 4: Collect results
	inventoryMap := make(map[int64]json.RawMessage)
	for result := range resultsChan {
		if result.Err == nil {
			inventoryMap[result.VendorItemId] = result.Data
		}
	}

	// Step 5: Build combined response
	type CombinedItem struct {
		SellerProductName string          `json:"sellerProductName"`
		VendorItemId      int64           `json:"vendorItemId"`
		VendorItemName    string          `json:"vendorItemName"`
		SalePrice         int             `json:"salePrice"`
		OriginalPrice     int             `json:"originalPrice"`
		StatusName        string          `json:"statusName"`
		Inventory         json.RawMessage `json:"inventory,omitempty"`
	}

	var combined []CombinedItem
	for _, item := range items {
		combined = append(combined, CombinedItem{
			SellerProductName: item.ProductName,
			VendorItemId:      item.VendorItemId,
			VendorItemName:    "",        // Will be filled from inventory API
			SalePrice:         0,          // Will be filled from inventory API
			OriginalPrice:     0,          // Will be filled from inventory API
			StatusName:        "",         // Will be filled from inventory API
			Inventory:         inventoryMap[item.VendorItemId],
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"code":    "SUCCESS",
		"message": "",
		"data":    combined,
	})
}
