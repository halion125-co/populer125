package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/labstack/echo/v4"
	echomiddleware "github.com/labstack/echo/v4/middleware"
	"github.com/rocketgrowth/backend/internal/config"
	"github.com/rocketgrowth/backend/internal/coupang"
	"github.com/rocketgrowth/backend/internal/database"
	"github.com/rocketgrowth/backend/internal/handlers"
	"github.com/rocketgrowth/backend/internal/middleware"
)

var cfg *config.Config

// itemMapCache: 상품명 매핑 정보를 서버 메모리에 캐시 (Products+Orders API 호출 최소화)
type itemMapCache struct {
	mu        sync.RWMutex
	data      map[int64]ItemInfo
	expiresAt time.Time
}

type ItemInfo struct {
	ProductName string
	ItemName    string
	StatusName  string
}

var globalItemCache = &itemMapCache{}

func (c *itemMapCache) get() (map[int64]ItemInfo, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if c.data == nil || time.Now().After(c.expiresAt) {
		return nil, false
	}
	return c.data, true
}

func (c *itemMapCache) set(data map[int64]ItemInfo) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.data = data
	c.expiresAt = time.Now().Add(10 * time.Minute)
}

func main() {
	cfg = config.Load()

	if err := database.Init(cfg.DatabasePath); err != nil {
		panic(fmt.Sprintf("Failed to initialize database: %v", err))
	}

	e := echo.New()

	e.Use(echomiddleware.Logger())
	e.Use(echomiddleware.Recover())
	e.Use(echomiddleware.CORS())

	// Public routes
	e.POST("/api/auth/login", handlers.Login(cfg))
	e.POST("/api/auth/register", handlers.Register(cfg))
	e.GET("/api/health", healthCheck)

	// Protected routes
	api := e.Group("/api")
	api.Use(middleware.JWTAuthMiddleware(cfg))

	api.GET("/profile", handlers.GetProfile)
	api.PUT("/profile", handlers.UpdateProfile)
	api.PUT("/profile/password", handlers.ChangePassword)

	api.GET("/coupang/products", getProductsProtected)
	api.GET("/coupang/orders", getOrdersProtected)
	api.GET("/coupang/inventory", getInventoryProtected)
	api.GET("/coupang/returns", getReturnsProtected)
	api.GET("/coupang/test", testCoupangAPI)

	port := fmt.Sprintf(":%s", cfg.ServerPort)
	e.Logger.Fatal(e.Start(port))
}

func healthCheck(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]interface{}{
		"status":  "ok",
		"message": "RocketGrowth API is running",
	})
}

func testCoupangAPI(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)
	return c.JSON(http.StatusOK, map[string]string{
		"message":   "Coupang API client initialized",
		"vendor_id": user.VendorID,
	})
}

func getProductsProtected(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)
	client := coupang.NewClient(user.VendorID, user.AccessKey, user.SecretKey)

	data, err := client.GetProducts()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSONBlob(http.StatusOK, data)
}

func getOrdersProtected(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)
	client := coupang.NewClient(user.VendorID, user.AccessKey, user.SecretKey)

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
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSONBlob(http.StatusOK, data)
}

// buildItemMap: Products + Orders API로 vendorItemId→상품명 매핑 생성 (캐시 우선)
func buildItemMap(client *coupang.Client) (map[int64]ItemInfo, error) {
	if cached, ok := globalItemCache.get(); ok {
		return cached, nil
	}

	type RgItemData struct {
		VendorItemId int64 `json:"vendorItemId"`
	}
	type ProductItem struct {
		ItemName             string      `json:"itemName"`
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

	itemMap := make(map[int64]ItemInfo)

	productsData, err := client.GetProducts()
	if err == nil {
		var productsResp ProductsResp
		if json.Unmarshal(productsData, &productsResp) == nil {
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
		}
	}

	// Orders API로 미매핑 상품 보완 (최근 3개월)
	now := time.Now()
	ordersTo := now.Format("2006-01-02")
	ordersFrom := now.AddDate(0, -3, 0).Format("2006-01-02")
	ordersData, err := client.GetOrders(ordersFrom, ordersTo)
	if err == nil {
		type OItem struct {
			VendorItemId int64  `json:"vendorItemId"`
			ProductName  string `json:"productName"`
		}
		type OOrder struct{ OrderItems []OItem `json:"orderItems"` }
		type OResp struct{ Data []OOrder `json:"data"` }
		var oResp OResp
		if json.Unmarshal(ordersData, &oResp) == nil {
			for _, order := range oResp.Data {
				for _, oi := range order.OrderItems {
					if oi.VendorItemId != 0 && oi.ProductName != "" {
						if _, exists := itemMap[oi.VendorItemId]; !exists {
							itemMap[oi.VendorItemId] = ItemInfo{
								ProductName: oi.ProductName,
								StatusName:  "판매이력",
							}
						}
					}
				}
			}
		}
	}

	globalItemCache.set(itemMap)
	return itemMap, nil
}

func getInventoryProtected(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)
	client := coupang.NewClient(user.VendorID, user.AccessKey, user.SecretKey)

	// 페이지 파라미터 파싱 (기본: page=1, pageSize=20)
	page, _ := strconv.Atoi(c.QueryParam("page"))
	pageSize, _ := strconv.Atoi(c.QueryParam("pageSize"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	// 1) 상품명 매핑 (캐시 사용)
	itemMap, err := buildItemMap(client)
	if err != nil {
		c.Logger().Errorf("buildItemMap failed: %v", err)
		// 매핑 실패해도 계속 진행 (빈 맵으로 처리)
		itemMap = make(map[int64]ItemInfo)
	}

	// 2) Inventory Summaries 전체 조회 (nextToken 페이지네이션)
	invRawItems, err := client.GetInventorySummaries()
	if err != nil {
		c.Logger().Errorf("GetInventorySummaries failed: %v", err)
		errMsg := err.Error()
		if strings.Contains(errMsg, "429") {
			return c.JSON(http.StatusTooManyRequests, map[string]string{"error": "쿠팡 API 요청 한도 초과. 잠시 후 다시 시도해주세요."})
		}
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
	type InventoryItem struct {
		VendorItemId    int64  `json:"vendorItemId"`
		ProductName     string `json:"productName"`
		ItemName        string `json:"itemName"`
		StatusName      string `json:"statusName"`
		StockQuantity   int    `json:"stockQuantity"`
		SalesLast30Days int    `json:"salesLast30Days"`
		IsMapped        bool   `json:"isMapped"`
	}

	// 전체 아이템 조립
	var allItems []InventoryItem
	for _, raw := range invRawItems {
		var inv InvSummaryItem
		if err := json.Unmarshal(raw, &inv); err != nil {
			continue
		}
		info, mapped := itemMap[inv.VendorItemId]
		allItems = append(allItems, InventoryItem{
			VendorItemId:    inv.VendorItemId,
			ProductName:     info.ProductName,
			ItemName:        info.ItemName,
			StatusName:      info.StatusName,
			StockQuantity:   inv.InventoryDetails.TotalOrderableQuantity,
			SalesLast30Days: inv.SalesCountMap.Last30Days,
			IsMapped:        mapped,
		})
	}

	// vendorItemId 오름차순 정렬
	sort.Slice(allItems, func(i, j int) bool {
		return allItems[i].VendorItemId > allItems[j].VendorItemId
	})

	totalCount := len(allItems)
	totalPages := (totalCount + pageSize - 1) / pageSize

	// 페이지 슬라이싱
	start := (page - 1) * pageSize
	end := start + pageSize
	if start >= totalCount {
		start = totalCount
	}
	if end > totalCount {
		end = totalCount
	}
	pageItems := allItems[start:end]

	c.Logger().Infof("Inventory: page=%d/%d, items=%d/%d", page, totalPages, len(pageItems), totalCount)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"code":       "SUCCESS",
		"message":    "",
		"data":       pageItems,
		"total":      totalCount,
		"page":       page,
		"pageSize":   pageSize,
		"totalPages": totalPages,
	})
}


// getReturnsProtected: 반품/취소 요청 목록 조회
// Query params: createdAtFrom, createdAtTo (YYYY-MM-DDTHH:MM), status (UC/RU/CC/PR, 기본 전체)
func getReturnsProtected(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)
	client := coupang.NewClient(user.VendorID, user.AccessKey, user.SecretKey)

	// 기본값: 최근 7일
	now := time.Now()
	from := c.QueryParam("createdAtFrom")
	to := c.QueryParam("createdAtTo")
	status := c.QueryParam("status")

	if from == "" {
		from = now.AddDate(0, 0, -7).Format("2006-01-02T00:00")
	}
	if to == "" {
		to = now.Format("2006-01-02T15:04")
	}

	path := fmt.Sprintf("/v2/providers/openapi/apis/api/v6/vendors/%s/returnRequests", user.VendorID)
	query := fmt.Sprintf("searchType=timeFrame&createdAtFrom=%s&createdAtTo=%s", from, to)
	if status != "" {
		query += "&status=" + status
	}

	body, err := client.Request("GET", path, query)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "parse error"})
	}

	// data 배열 추출
	data := result["data"]
	if data == nil {
		data = []interface{}{}
	}

	dataSlice, ok := data.([]interface{})
	if !ok {
		dataSlice = []interface{}{}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"code":          "SUCCESS",
		"data":          dataSlice,
		"total":         len(dataSlice),
		"createdAtFrom": from,
		"createdAtTo":   to,
		"status":        status,
	})
}
