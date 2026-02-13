package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"

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

	// Use Rocket Warehouse Inventory Summaries API - gets ALL inventory at once!
	invData, err := client.GetInventorySummaries()
	if err != nil {
		c.Logger().Errorf("GetInventorySummaries failed: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Unable to fetch inventory from Coupang API. Please try again later.",
		})
	}

	// DEBUG: Save raw response to file for inspection
	os.WriteFile("/app/inventory_raw_response.json", invData, 0644)

	// Parse the inventory summaries response
	var invResp struct {
		Code    interface{}       `json:"code"` // Can be string or number
		Message string            `json:"message"`
		Data    []json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(invData, &invResp); err != nil {
		c.Logger().Errorf("Failed to parse inventory response: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to parse inventory data",
		})
	}

	// DEBUG: Log first item to see actual structure
	if len(invResp.Data) > 0 {
		c.Logger().Infof("DEBUG: First inventory item raw JSON: %s", string(invResp.Data[0]))
	}

	// Parse each inventory item
	type InventoryItem struct {
		SellerProductName      string `json:"sellerProductName"`
		VendorItemId           int64  `json:"vendorItemId"`
		VendorItemName         string `json:"vendorItemName"`
		Quantity               int    `json:"quantity"`
		StockAvailableQuantity int    `json:"stockAvailableQuantity"`
		WarehouseQuantity      int    `json:"warehouseQuantity"`
		SalePrice              int    `json:"salePrice"`
		OriginalPrice          int    `json:"originalPrice"`
		StatusName             string `json:"statusName"`
	}

	var items []InventoryItem
	for _, itemRaw := range invResp.Data {
		var item InventoryItem
		if err := json.Unmarshal(itemRaw, &item); err != nil {
			c.Logger().Warnf("Failed to parse inventory item: %v", err)
			continue
		}
		items = append(items, item)
	}

	c.Logger().Infof("Retrieved %d inventory items from Rocket Warehouse API", len(items))

	return c.JSON(http.StatusOK, map[string]interface{}{
		"code":    "SUCCESS",
		"message": "",
		"data":    items,
	})
}
