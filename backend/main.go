package main

import (
	"encoding/json"
	"fmt"
	"net/http"

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

	// 1) Products API에서 vendorItemId -> 상품명/옵션명 매핑 생성
	productsData, err := client.GetProducts()
	if err != nil {
		c.Logger().Errorf("GetProducts failed: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to fetch products"})
	}

	type RgItemData struct {
		VendorItemId int64 `json:"vendorItemId"`
	}
	type ProductItem struct {
		ItemName          string     `json:"itemName"`
		RocketGrowthItemData *RgItemData `json:"rocketGrowthItemData"`
	}
	type Product struct {
		SellerProductName string        `json:"sellerProductName"`
		StatusName        string        `json:"statusName"`
		Items             []ProductItem `json:"items"`
	}
	type ProductsResp struct {
		Code string    `json:"code"`
		Data []Product `json:"data"`
	}

	var productsResp ProductsResp
	if err := json.Unmarshal(productsData, &productsResp); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to parse products"})
	}

	// vendorItemId -> {상품명, 옵션명, 상태} 맵
	type ItemInfo struct {
		ProductName string
		ItemName    string
		StatusName  string
	}
	itemMap := make(map[int64]ItemInfo)
	for _, p := range productsResp.Data {
		for _, it := range p.Items {
			if it.RocketGrowthItemData != nil && it.RocketGrowthItemData.VendorItemId != 0 {
				itemMap[it.RocketGrowthItemData.VendorItemId] = ItemInfo{
					ProductName: p.SellerProductName,
					ItemName:    it.ItemName,
					StatusName:  p.StatusName,
				}
			}
		}
	}

	// 2) Inventory Summaries API 호출
	invData, err := client.GetInventorySummaries()
	if err != nil {
		c.Logger().Errorf("GetInventorySummaries failed: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to fetch inventory"})
	}

	type SalesCountMap struct {
		Last30Days int `json:"SALES_COUNT_LAST_THIRTY_DAYS"`
	}
	type InventoryDetails struct {
		TotalOrderableQuantity int `json:"totalOrderableQuantity"`
	}
	type InvSummaryItem struct {
		VendorItemId     int64            `json:"vendorItemId"`
		SalesCountMap    SalesCountMap    `json:"salesCountMap"`
		InventoryDetails InventoryDetails `json:"inventoryDetails"`
	}
	type InvResp struct {
		Message string           `json:"message"`
		Data    []InvSummaryItem `json:"data"`
	}

	var invResp InvResp
	if err := json.Unmarshal(invData, &invResp); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to parse inventory"})
	}

	// 3) 두 데이터 합산
	type InventoryItem struct {
		VendorItemId     int64  `json:"vendorItemId"`
		ProductName      string `json:"productName"`
		ItemName         string `json:"itemName"`
		StatusName       string `json:"statusName"`
		StockQuantity    int    `json:"stockQuantity"`
		SalesLast30Days  int    `json:"salesLast30Days"`
	}

	var items []InventoryItem
	for _, inv := range invResp.Data {
		info := itemMap[inv.VendorItemId]
		items = append(items, InventoryItem{
			VendorItemId:    inv.VendorItemId,
			ProductName:     info.ProductName,
			ItemName:        info.ItemName,
			StatusName:      info.StatusName,
			StockQuantity:   inv.InventoryDetails.TotalOrderableQuantity,
			SalesLast30Days: inv.SalesCountMap.Last30Days,
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"code":    "SUCCESS",
		"message": "",
		"data":    items,
	})
}
