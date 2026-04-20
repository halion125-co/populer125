package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/labstack/echo/v4"
	echomiddleware "github.com/labstack/echo/v4/middleware"
	"github.com/rocketgrowth/backend/internal/config"
	"github.com/rocketgrowth/backend/internal/coupang"
	"github.com/rocketgrowth/backend/internal/database"
	"github.com/rocketgrowth/backend/internal/fcm"
	"github.com/rocketgrowth/backend/internal/handlers"
	"github.com/rocketgrowth/backend/internal/middleware"
)

var cfg *config.Config

func main() {
	cfg = config.Load()

	if err := database.Init(cfg.DatabasePath); err != nil {
		panic(fmt.Sprintf("Failed to initialize database: %v", err))
	}

	if err := fcm.Init(cfg.FCMCredentialsPath); err != nil {
		panic(fmt.Sprintf("Failed to initialize FCM: %v", err))
	}

	e := echo.New()

	e.Use(echomiddleware.Logger())
	e.Use(echomiddleware.Recover())
	e.Use(echomiddleware.CORS())

	// Public routes
	e.POST("/api/auth/login", handlers.Login(cfg))
	e.POST("/api/auth/register", handlers.Register(cfg))
	e.POST("/api/auth/refresh", handlers.RefreshToken(cfg))
	e.GET("/api/health", healthCheck)

	// Protected routes
	api := e.Group("/api")
	api.Use(middleware.JWTAuthMiddleware(cfg))

	api.GET("/profile", handlers.GetProfile)
	api.PUT("/profile", handlers.UpdateProfile)
	api.PUT("/profile/password", handlers.ChangePassword)

	// DB 조회 (동기화된 데이터 반환)
	api.GET("/coupang/products", getProductsFromDB)
	api.GET("/coupang/products/:productId/items", getProductItemsFromDB)
	api.GET("/coupang/inventory", getInventoryFromDB)
	api.GET("/coupang/inventory/alerts", getInventoryAlerts)
	api.GET("/coupang/orders", getOrdersFromDB)
	api.GET("/coupang/returns", getReturnsFromDB)

	// 동기화 (쿠팡 API 호출 → DB 저장)
	api.POST("/coupang/sync/products", syncProducts)
	api.POST("/coupang/sync/inventory", syncInventory)
	api.POST("/coupang/sync/orders", syncOrders)
	api.POST("/coupang/sync/returns", syncReturns)

	// 동기화 상태 조회
	api.GET("/coupang/sync/status", getSyncStatus)

	// 테스트
	api.GET("/coupang/test", testCoupangAPI)

	// 배치 관리
	api.GET("/batch/jobs", getBatchJobs)
	api.POST("/batch/jobs/:jobType/run", runBatchJob)
	api.GET("/batch/logs", getBatchLogs)

	// 슬랙 웹훅 관리
	api.GET("/slack/webhooks", getSlackWebhooks)
	api.POST("/slack/webhooks", createSlackWebhook)
	api.PUT("/slack/webhooks/:id", updateSlackWebhook)
	api.DELETE("/slack/webhooks/:id", deleteSlackWebhook)

	// 슬랙 설정 (폴링 간격)
	api.GET("/slack/settings", getSlackSettings)
	api.PUT("/slack/settings", updateSlackSettings)

	// 슬랙 즉시 발송
	api.POST("/slack/send-today", sendTodaySlack)

	// 모바일 - FCM 디바이스 토큰
	api.POST("/device-tokens", handlers.RegisterDeviceToken)
	api.DELETE("/device-tokens", handlers.RemoveDeviceToken)

	// 모바일 - 알림 내역 및 설정
	api.GET("/notifications/history", handlers.GetNotificationHistory)
	api.GET("/notifications/settings", handlers.GetNotificationSettings)
	api.PUT("/notifications/settings", handlers.UpdateNotificationSettings)

	// 스케줄러 시작 (매일 KST 00:00)
	go startScheduler(e)
	go startOrderPolling(e)
	// 재고 1시간마다 자동 동기화
	go startInventoryHourlyScheduler(e)

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

// ─── 헬퍼: sync_status 조회/갱신 ──────────────────────────────────────────

// getLastSyncedAt: 마지막 동기화 시각 반환 (없으면 빈 문자열)
func getLastSyncedAt(userID int64, dataType string) string {
	var lastSynced string
	err := database.DB.QueryRow(
		"SELECT COALESCE(last_synced_at, '') FROM sync_status WHERE user_id = ? AND data_type = ?",
		userID, dataType,
	).Scan(&lastSynced)
	if err != nil {
		return ""
	}
	return lastSynced
}

// upsertSyncStatus: 동기화 상태 저장 (INSERT OR REPLACE)
func upsertSyncStatus(userID int64, dataType string, count int) {
	now := time.Now().UTC().Format("2006-01-02T15:04:05Z")
	database.DB.Exec(`
		INSERT INTO sync_status (user_id, data_type, last_synced_at, record_count)
		VALUES (?, ?, ?, ?)
		ON CONFLICT(user_id, data_type) DO UPDATE SET
			last_synced_at = excluded.last_synced_at,
			record_count = excluded.record_count
	`, userID, dataType, now, count)
}

// ─── DB 조회 핸들러 ────────────────────────────────────────────────────────

// getProductsFromDB: DB에서 상품 목록 반환
func getProductsFromDB(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)

	type Product struct {
		ID                  int64  `json:"id"`
		SellerProductID     int64  `json:"sellerProductId"`
		SellerProductName   string `json:"sellerProductName"`
		Brand               string `json:"brand"`
		StatusName          string `json:"statusName"`
		SaleStartedAt       string `json:"saleStartedAt"`
		SaleEndedAt         string `json:"saleEndedAt"`
		DisplayCategoryCode int64  `json:"displayCategoryCode"`
		CategoryID          int64  `json:"categoryId"`
		RegistrationType    string `json:"registrationType"`
		ItemCount           int    `json:"itemCount"`
		SyncedAt            string `json:"syncedAt"`
	}

	rows, err := database.DB.Query(`
		SELECT id, seller_product_id, seller_product_name, brand, status_name,
		       sale_started_at, sale_ended_at, display_category_code, category_id,
		       registration_type, item_count, synced_at
		FROM products
		WHERE user_id = ?
		ORDER BY seller_product_id ASC
	`, user.UserID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "DB 조회 실패"})
	}
	defer rows.Close()

	var products []Product
	for rows.Next() {
		var p Product
		if err := rows.Scan(&p.ID, &p.SellerProductID, &p.SellerProductName, &p.Brand,
			&p.StatusName, &p.SaleStartedAt, &p.SaleEndedAt, &p.DisplayCategoryCode,
			&p.CategoryID, &p.RegistrationType, &p.ItemCount, &p.SyncedAt); err != nil {
			continue
		}
		products = append(products, p)
	}
	if products == nil {
		products = []Product{}
	}

	lastSynced := getLastSyncedAt(user.UserID, "products")
	return c.JSON(http.StatusOK, map[string]interface{}{
		"code":          "SUCCESS",
		"data":          products,
		"total":         len(products),
		"lastSyncedAt":  lastSynced,
	})
}

// getProductItemsFromDB: DB에서 특정 상품의 옵션 목록 반환
func getProductItemsFromDB(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)
	productIdStr := c.Param("productId")
	productId, err := strconv.ParseInt(productIdStr, 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid productId"})
	}

	type ProductItem struct {
		VendorItemID  int64  `json:"vendorItemId"`
		ItemName      string `json:"itemName"`
		StatusName    string `json:"statusName"`
		StockQuantity int    `json:"stockQuantity"`
		SalesLast30   int    `json:"salesLast30Days"`
	}

	// 상품 기본 정보 조회
	var productName, brand, statusName string
	err = database.DB.QueryRow(`
		SELECT seller_product_name, brand, status_name
		FROM products
		WHERE user_id = ? AND seller_product_id = ?
	`, user.UserID, productId).Scan(&productName, &brand, &statusName)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "상품을 찾을 수 없습니다"})
	}

	// inventory 테이블에서 해당 상품의 옵션 목록 조회 (로켓그로스 재고 현황 기반)
	rows, err := database.DB.Query(`
		SELECT vendor_item_id, item_name, status_name, stock_quantity, sales_last_30_days
		FROM inventory
		WHERE user_id = ? AND seller_product_id = ?
		ORDER BY vendor_item_id ASC
	`, user.UserID, productId)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "DB 조회 실패"})
	}
	defer rows.Close()

	var items []ProductItem
	for rows.Next() {
		var it ProductItem
		if err := rows.Scan(&it.VendorItemID, &it.ItemName, &it.StatusName,
			&it.StockQuantity, &it.SalesLast30); err != nil {
			continue
		}
		items = append(items, it)
	}
	if items == nil {
		items = []ProductItem{}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"code":              "SUCCESS",
		"sellerProductId":   productId,
		"sellerProductName": productName,
		"statusName":        statusName,
		"brand":             brand,
		"items":             items,
	})
}

// getInventoryFromDB: DB에서 재고 목록 반환 (페이지네이션 + 서버사이드 필터)
func getInventoryFromDB(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)

	page, _ := strconv.Atoi(c.QueryParam("page"))
	pageSize, _ := strconv.Atoi(c.QueryParam("pageSize"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	productName  := c.QueryParam("productName")
	optionName   := c.QueryParam("optionName")
	stockStatus  := c.QueryParam("stockStatus")  // "all" | "in_stock" | "out_of_stock"
	mappedOnly   := c.QueryParam("mappedOnly")    // "true" | "false" | "" (전체)
	createdAtFrom := c.QueryParam("createdAtFrom") // yyyy-MM-dd (KST)
	createdAtTo   := c.QueryParam("createdAtTo")   // yyyy-MM-dd (KST)
	alertType    := c.QueryParam("alertType")     // "new" | "out_of_stock" | "" (전체)

	type InventoryItem struct {
		VendorItemID    int64  `json:"vendorItemId"`
		ProductName     string `json:"productName"`
		ItemName        string `json:"itemName"`
		StatusName      string `json:"statusName"`
		StockQuantity   int    `json:"stockQuantity"`
		SalesLast30Days int    `json:"salesLast30Days"`
		IsMapped        bool   `json:"isMapped"`
		SyncedAt        string `json:"syncedAt"`
		CreatedAt       string `json:"createdAt"`
		OutOfStockAt    string `json:"outOfStockAt"`
	}

	// 전체 통계 (필터 무관, 전체 기준)
	var totalAll, totalInStock, totalOutOfStock int
	database.DB.QueryRow("SELECT COUNT(*) FROM inventory WHERE user_id = ?", user.UserID).Scan(&totalAll)
	database.DB.QueryRow("SELECT COUNT(*) FROM inventory WHERE user_id = ? AND stock_quantity > 0", user.UserID).Scan(&totalInStock)
	totalOutOfStock = totalAll - totalInStock

	// 필터 조건 조립
	where := "WHERE user_id = ?"
	args := []interface{}{user.UserID}

	if mappedOnly == "true" {
		where += " AND is_mapped = 1"
	} else if mappedOnly == "false" {
		where += " AND is_mapped = 0"
	}
	if productName != "" {
		where += " AND product_name LIKE ?"
		args = append(args, "%"+productName+"%")
	}
	if optionName != "" {
		where += " AND item_name LIKE ?"
		args = append(args, "%"+optionName+"%")
	}
	if stockStatus == "in_stock" {
		where += " AND stock_quantity > 0"
	} else if stockStatus == "out_of_stock" {
		where += " AND stock_quantity = 0"
	}

	// 생성일자 필터 (KST → UTC 변환)
	kst := time.FixedZone("KST", 9*60*60)
	if createdAtFrom != "" {
		if t, err := time.ParseInLocation("2006-01-02", createdAtFrom, kst); err == nil {
			where += " AND COALESCE(created_at, synced_at) >= ?"
			args = append(args, t.UTC().Format(time.RFC3339))
		}
	}
	if createdAtTo != "" {
		if t, err := time.ParseInLocation("2006-01-02", createdAtTo, kst); err == nil {
			where += " AND COALESCE(created_at, synced_at) < ?"
			args = append(args, t.Add(24*time.Hour).UTC().Format(time.RFC3339))
		}
	}

	// alertType: 최근 7일 신규/품절 필터
	sevenDaysAgo := time.Now().UTC().Add(-7 * 24 * time.Hour).Format("2006-01-02 15:04:05")
	if alertType == "new" {
		where += " AND COALESCE(created_at, synced_at) >= ?"
		args = append(args, sevenDaysAgo)
	} else if alertType == "out_of_stock" {
		where += " AND out_of_stock_at IS NOT NULL AND out_of_stock_at >= ?"
		args = append(args, sevenDaysAgo)
	} else if alertType == "recent" {
		// 신규 OR 품절 (둘 중 하나라도 해당)
		where += " AND (COALESCE(created_at, synced_at) >= ? OR (out_of_stock_at IS NOT NULL AND out_of_stock_at >= ?))"
		args = append(args, sevenDaysAgo, sevenDaysAgo)
	}

	// 필터 적용 건수
	var filteredCount int
	database.DB.QueryRow("SELECT COUNT(*) FROM inventory "+where, args...).Scan(&filteredCount)

	// 데이터 조회
	queryArgs := append(args, alertType, alertType, pageSize, (page-1)*pageSize)
	rows, err := database.DB.Query(`
		SELECT vendor_item_id, product_name, item_name, status_name,
		       stock_quantity, sales_last_30_days, is_mapped, synced_at,
		       COALESCE(created_at, synced_at), COALESCE(out_of_stock_at, '')
		FROM inventory
		`+where+`
		ORDER BY CASE WHEN ? = 'new' THEN COALESCE(created_at, synced_at)
		              WHEN ? = 'out_of_stock' THEN out_of_stock_at
		              ELSE NULL END DESC NULLS LAST,
		         vendor_item_id DESC
		LIMIT ? OFFSET ?
	`, queryArgs...)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "DB 조회 실패"})
	}
	defer rows.Close()

	var items []InventoryItem
	for rows.Next() {
		var it InventoryItem
		var isMapped int
		if err := rows.Scan(&it.VendorItemID, &it.ProductName, &it.ItemName,
			&it.StatusName, &it.StockQuantity, &it.SalesLast30Days,
			&isMapped, &it.SyncedAt, &it.CreatedAt, &it.OutOfStockAt); err != nil {
			continue
		}
		it.IsMapped = isMapped == 1
		items = append(items, it)
	}
	if items == nil {
		items = []InventoryItem{}
	}

	totalPages := (filteredCount + pageSize - 1) / pageSize
	lastSynced := getLastSyncedAt(user.UserID, "inventory")

	return c.JSON(http.StatusOK, map[string]interface{}{
		"code":            "SUCCESS",
		"data":            items,
		"total":           filteredCount,
		"totalAll":        totalAll,
		"totalInStock":    totalInStock,
		"totalOutOfStock": totalOutOfStock,
		"page":            page,
		"pageSize":        pageSize,
		"totalPages":      totalPages,
		"lastSyncedAt":    lastSynced,
	})
}

// getInventoryAlerts: 최근 7일 신규 추가 + 품절 통합 목록 반환
func getInventoryAlerts(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)

	type AlertItem struct {
		AlertType       string `json:"alertType"` // "new" | "out_of_stock"
		VendorItemID    int64  `json:"vendorItemId"`
		ProductName     string `json:"productName"`
		ItemName        string `json:"itemName"`
		StockQuantity   int    `json:"stockQuantity"`
		SalesLast30Days int    `json:"salesLast30Days"`
		AlertAt         string `json:"alertAt"`
	}

	sevenDaysAgo := time.Now().UTC().Add(-7 * 24 * time.Hour).Format("2006-01-02 15:04:05")
	var items []AlertItem

	// 신규 추가 (최근 7일 created_at)
	newRows, err := database.DB.Query(`
		SELECT vendor_item_id, product_name, item_name, stock_quantity, sales_last_30_days,
		       COALESCE(created_at, synced_at)
		FROM inventory
		WHERE user_id = ? AND COALESCE(created_at, synced_at) >= ?
		ORDER BY COALESCE(created_at, synced_at) DESC
	`, user.UserID, sevenDaysAgo)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "DB 조회 실패"})
	}
	defer newRows.Close()
	for newRows.Next() {
		var it AlertItem
		it.AlertType = "new"
		if err := newRows.Scan(&it.VendorItemID, &it.ProductName, &it.ItemName,
			&it.StockQuantity, &it.SalesLast30Days, &it.AlertAt); err != nil {
			continue
		}
		items = append(items, it)
	}

	// 품절 (최근 7일 out_of_stock_at) — 이미 신규에 포함된 vendor_item_id는 제외
	outRows, err := database.DB.Query(`
		SELECT vendor_item_id, product_name, item_name, stock_quantity, sales_last_30_days, out_of_stock_at
		FROM inventory
		WHERE user_id = ? AND out_of_stock_at IS NOT NULL AND out_of_stock_at >= ?
		  AND COALESCE(created_at, synced_at) < ?
		ORDER BY out_of_stock_at DESC
	`, user.UserID, sevenDaysAgo, sevenDaysAgo)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "DB 조회 실패"})
	}
	defer outRows.Close()
	for outRows.Next() {
		var it AlertItem
		it.AlertType = "out_of_stock"
		if err := outRows.Scan(&it.VendorItemID, &it.ProductName, &it.ItemName,
			&it.StockQuantity, &it.SalesLast30Days, &it.AlertAt); err != nil {
			continue
		}
		items = append(items, it)
	}

	if items == nil {
		items = []AlertItem{}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"code":  "SUCCESS",
		"items": items,
	})
}

// getOrdersFromDB: DB에서 주문 목록 반환
func getOrdersFromDB(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)

	// 프론트에서 KST 날짜(yyyy-MM-dd)로 전달되므로 UTC로 변환하여 DB 조회
	kst := time.FixedZone("KST", 9*60*60)
	var fromUTC, toUTC string
	if from := c.QueryParam("createdAtFrom"); from != "" {
		if t, err := time.ParseInLocation("2006-01-02", from, kst); err == nil {
			fromUTC = t.UTC().Format(time.RFC3339)
		} else {
			fromUTC = from
		}
	}
	if to := c.QueryParam("createdAtTo"); to != "" {
		// to날짜의 KST 23:59:59까지 포함
		if t, err := time.ParseInLocation("2006-01-02T15:04:05", to, kst); err == nil {
			toUTC = t.UTC().Format(time.RFC3339)
		} else if t, err := time.ParseInLocation("2006-01-02", to, kst); err == nil {
			toUTC = t.Add(24*time.Hour - time.Second).UTC().Format(time.RFC3339)
		} else {
			toUTC = to
		}
	}

	type OrderItem struct {
		VendorItemID  int64   `json:"vendorItemId"`
		ProductName   string  `json:"productName"`
		SalesQuantity int     `json:"salesQuantity"`
		UnitPrice     float64 `json:"unitPrice"`
		SalesPrice    float64 `json:"salesPrice"`
	}
	type Order struct {
		OrderID   int64       `json:"orderId"`
		PaidAt    string      `json:"paidAt"`
		SyncedAt  string      `json:"syncedAt"`
		OrderItems []OrderItem `json:"orderItems"`
	}

	query := "SELECT order_id, paid_at, synced_at FROM orders WHERE user_id = ?"
	args := []interface{}{user.UserID}

	if fromUTC != "" {
		query += " AND paid_at >= ?"
		args = append(args, fromUTC)
	}
	if toUTC != "" {
		query += " AND paid_at <= ?"
		args = append(args, toUTC)
	}
	query += " ORDER BY paid_at DESC"

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "DB 조회 실패"})
	}
	defer rows.Close()

	var orders []Order
	for rows.Next() {
		var o Order
		if err := rows.Scan(&o.OrderID, &o.PaidAt, &o.SyncedAt); err != nil {
			continue
		}

		// 주문 아이템 조회
		itemRows, err := database.DB.Query(`
			SELECT vendor_item_id, product_name, sales_quantity, unit_price, sales_price
			FROM order_items
			WHERE user_id = ? AND order_id = ?
		`, user.UserID, o.OrderID)
		if err == nil {
			for itemRows.Next() {
				var oi OrderItem
				if err := itemRows.Scan(&oi.VendorItemID, &oi.ProductName,
					&oi.SalesQuantity, &oi.UnitPrice, &oi.SalesPrice); err == nil {
					o.OrderItems = append(o.OrderItems, oi)
				}
			}
			itemRows.Close()
		}
		if o.OrderItems == nil {
			o.OrderItems = []OrderItem{}
		}
		orders = append(orders, o)
	}
	if orders == nil {
		orders = []Order{}
	}

	lastSynced := getLastSyncedAt(user.UserID, "orders")
	return c.JSON(http.StatusOK, map[string]interface{}{
		"code":         "SUCCESS",
		"data":         orders,
		"total":        len(orders),
		"lastSyncedAt": lastSynced,
	})
}

// getReturnsFromDB: DB에서 반품 목록 반환
func getReturnsFromDB(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)

	createdAtFrom := c.QueryParam("createdAtFrom")
	createdAtTo := c.QueryParam("createdAtTo")
	status := c.QueryParam("status")

	type ReturnItem struct {
		ReceiptID        int64  `json:"receiptId"`
		OrderID          int64  `json:"orderId"`
		Status           string `json:"status"`
		StatusName       string `json:"statusName"`
		ProductName      string `json:"productName"`
		ItemName         string `json:"itemName"`
		VendorItemID     int64  `json:"vendorItemId"`
		ReturnCount      int    `json:"returnCount"`
		SalesQuantity    int    `json:"salesQuantity"`
		ReturnReason     string `json:"returnReason"`
		ReturnReasonCode string `json:"returnReasonCode"`
		CreatedAtAPI     string `json:"createdAtApi"`
		CancelledAt      string `json:"cancelledAt"`
		ReturnedAt       string `json:"returnedAt"`
		SyncedAt         string `json:"syncedAt"`
	}

	query := "SELECT receipt_id, order_id, status, status_name, product_name, COALESCE(item_name,''), vendor_item_id, return_count, sales_quantity, return_reason, return_reason_code, created_at_api, cancelled_at, returned_at, synced_at FROM returns WHERE user_id = ?"
	args := []interface{}{user.UserID}

	if createdAtFrom != "" {
		query += " AND created_at_api >= ?"
		args = append(args, createdAtFrom)
	}
	if createdAtTo != "" {
		query += " AND created_at_api <= ?"
		args = append(args, createdAtTo)
	}
	if status != "" {
		query += " AND status = ?"
		args = append(args, status)
	}
	query += " ORDER BY created_at_api DESC"

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "DB 조회 실패"})
	}
	defer rows.Close()

	var returns []ReturnItem
	for rows.Next() {
		var r ReturnItem
		if err := rows.Scan(&r.ReceiptID, &r.OrderID, &r.Status, &r.StatusName,
			&r.ProductName, &r.ItemName, &r.VendorItemID, &r.ReturnCount, &r.SalesQuantity,
			&r.ReturnReason, &r.ReturnReasonCode, &r.CreatedAtAPI,
			&r.CancelledAt, &r.ReturnedAt, &r.SyncedAt); err != nil {
			continue
		}
		returns = append(returns, r)
	}
	if returns == nil {
		returns = []ReturnItem{}
	}

	lastSynced := getLastSyncedAt(user.UserID, "returns")
	return c.JSON(http.StatusOK, map[string]interface{}{
		"code":         "SUCCESS",
		"data":         returns,
		"total":        len(returns),
		"lastSyncedAt": lastSynced,
	})
}

// ─── 동기화 핸들러 (쿠팡 API → DB 저장) ───────────────────────────────────

// syncProducts: 쿠팡 상품 API 호출 → products + product_items 테이블 저장
// 상품 목록 API는 items를 포함하지 않으므로, 상품별로 상세 API를 별도 호출하여 options(items)를 가져옴
func syncProducts(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)
	client := coupang.NewClient(user.VendorID, user.AccessKey, user.SecretKey)

	// Step 1: 상품 목록 조회 (items 없음)
	data, err := client.GetProducts()
	if err != nil {
		c.Logger().Errorf("syncProducts GetProducts failed: %v", err)
		errMsg := err.Error()
		if strings.Contains(errMsg, "429") {
			return c.JSON(http.StatusTooManyRequests, map[string]string{"error": "쿠팡 API 요청 한도 초과. 잠시 후 다시 시도해주세요."})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	type RgItemData struct {
		VendorItemId int64 `json:"vendorItemId"`
		ItemId       int64 `json:"itemId"`
	}
	type ProductItem struct {
		ItemName              string      `json:"itemName"`
		SellerProductItemName string      `json:"sellerProductItemName"`
		ExternalVendorSku     string      `json:"externalVendorSku"`
		OriginalPrice         float64     `json:"originalPrice"`
		SalePrice             float64     `json:"salePrice"`
		StatusName            string      `json:"statusName"`
		RocketGrowthItemData  *RgItemData `json:"rocketGrowthItemData"`
	}
	type Product struct {
		SellerProductId     int64         `json:"sellerProductId"`
		SellerProductName   string        `json:"sellerProductName"`
		Brand               string        `json:"brand"`
		StatusName          string        `json:"statusName"`
		SaleStartedAt       string        `json:"saleStartedAt"`
		SaleEndedAt         string        `json:"saleEndedAt"`
		DisplayCategoryCode int64         `json:"displayCategoryCode"`
		CategoryId          int64         `json:"categoryId"`
		RegistrationType    string        `json:"registrationType"`
		Items               []ProductItem `json:"items"`
	}
	type ProductsResp struct {
		Code string    `json:"code"`
		Data []Product `json:"data"`
	}
	type DetailResp struct {
		Code string  `json:"code"`
		Data Product `json:"data"`
	}

	var productsResp ProductsResp
	if err := json.Unmarshal(data, &productsResp); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "응답 파싱 실패"})
	}

	// Step 2: 상품별 상세 조회를 병렬로 수행 (items/options 포함)
	type DetailResult struct {
		Product Product
		Err     error
	}
	resultChan := make(chan DetailResult, len(productsResp.Data))
	var wg sync.WaitGroup

	for _, p := range productsResp.Data {
		wg.Add(1)
		go func(baseProduct Product) {
			defer wg.Done()
			detailData, err := client.GetProductDetail(baseProduct.SellerProductId)
			if err != nil {
				// 상세 조회 실패 시 기본 정보만 사용 (items 없이)
				resultChan <- DetailResult{Product: baseProduct, Err: err}
				return
			}
			var detailResp DetailResp
			if err := json.Unmarshal(detailData, &detailResp); err != nil {
				resultChan <- DetailResult{Product: baseProduct, Err: err}
				return
			}
			// 상세 응답의 items를 기본 정보에 합쳐서 반환
			merged := detailResp.Data
			// 상세 응답에 기본 정보가 없을 경우 대비
			if merged.SellerProductId == 0 {
				merged = baseProduct
			}
			resultChan <- DetailResult{Product: merged, Err: nil}
		}(p)
	}

	go func() {
		wg.Wait()
		close(resultChan)
	}()

	// Step 3: 결과 수집
	var detailedProducts []Product
	for result := range resultChan {
		detailedProducts = append(detailedProducts, result.Product)
	}

	// Step 4: DB에 저장
	productCount := 0
	itemCount := 0

	for _, p := range detailedProducts {
		// products 테이블 upsert
		// 이 상품의 유효한 RG item 개수 계산
		rgItemCount := 0
		for _, it := range p.Items {
			if it.RocketGrowthItemData != nil && it.RocketGrowthItemData.ItemId != 0 {
				rgItemCount++
			}
		}

		_, err := database.DB.Exec(`
			INSERT INTO products (user_id, seller_product_id, seller_product_name, brand, status_name,
				sale_started_at, sale_ended_at, display_category_code, category_id, registration_type, item_count, synced_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
			ON CONFLICT(user_id, seller_product_id) DO UPDATE SET
				seller_product_name = excluded.seller_product_name,
				brand = excluded.brand,
				status_name = excluded.status_name,
				sale_started_at = excluded.sale_started_at,
				sale_ended_at = excluded.sale_ended_at,
				display_category_code = excluded.display_category_code,
				category_id = excluded.category_id,
				registration_type = excluded.registration_type,
				item_count = excluded.item_count,
				synced_at = CURRENT_TIMESTAMP
		`, user.UserID, p.SellerProductId, p.SellerProductName, p.Brand, p.StatusName,
			p.SaleStartedAt, p.SaleEndedAt, p.DisplayCategoryCode, p.CategoryId, p.RegistrationType, rgItemCount)
		if err != nil {
			c.Logger().Errorf("products upsert failed: %v", err)
			continue
		}
		productCount++

		// product_items 테이블 upsert (상세 API에서 가져온 items)
		// itemId와 vendorItemId는 rocketGrowthItemData 하위에 있음
		for _, it := range p.Items {
			if it.RocketGrowthItemData == nil {
				continue // 로켓그로스 데이터 없으면 skip
			}
			itemId := it.RocketGrowthItemData.ItemId
			vendorItemId := it.RocketGrowthItemData.VendorItemId
			if itemId == 0 {
				continue
			}
			_, err := database.DB.Exec(`
				INSERT INTO product_items (user_id, seller_product_id, item_id, item_name,
					seller_product_item_name, external_vendor_sku, original_price, sale_price,
					status_name, vendor_item_id, synced_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
				ON CONFLICT(user_id, item_id) DO UPDATE SET
					item_name = excluded.item_name,
					seller_product_item_name = excluded.seller_product_item_name,
					external_vendor_sku = excluded.external_vendor_sku,
					original_price = excluded.original_price,
					sale_price = excluded.sale_price,
					status_name = excluded.status_name,
					vendor_item_id = excluded.vendor_item_id,
					synced_at = CURRENT_TIMESTAMP
			`, user.UserID, p.SellerProductId, itemId, it.ItemName,
				it.SellerProductItemName, it.ExternalVendorSku, it.OriginalPrice, it.SalePrice,
				it.StatusName, vendorItemId)
			if err != nil {
				c.Logger().Errorf("product_items upsert failed: %v", err)
				continue
			}
			itemCount++
		}
	}

	upsertSyncStatus(user.UserID, "products", productCount)

	// ── 재고 자동 동기화 ──────────────────────────────────────────────────────
	invClient := coupang.NewClient(user.VendorID, user.AccessKey, user.SecretKey)
	invRawItems, invErr := invClient.GetInventorySummaries()
	invCount := 0
	if invErr == nil {
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
		type ItemInfo struct {
			SellerProductId int64
			ProductName     string
			ItemName        string
			StatusName      string
		}
		itemMap := make(map[int64]ItemInfo)
		rows, qErr := database.DB.Query(`
			SELECT pi.vendor_item_id, pi.seller_product_id, p.seller_product_name, pi.item_name, pi.status_name
			FROM product_items pi
			JOIN products p ON p.user_id = pi.user_id AND p.seller_product_id = pi.seller_product_id
			WHERE pi.user_id = ? AND pi.vendor_item_id > 0
		`, user.UserID)
		if qErr == nil {
			for rows.Next() {
				var vid, spid int64
				var pname, iname, sname string
				if rows.Scan(&vid, &spid, &pname, &iname, &sname) == nil {
					itemMap[vid] = ItemInfo{SellerProductId: spid, ProductName: pname, ItemName: iname, StatusName: sname}
				}
			}
			rows.Close()
		}
		for _, raw := range invRawItems {
			var inv InvSummaryItem
			if err := json.Unmarshal(raw, &inv); err != nil {
				continue
			}
			info, mapped := itemMap[inv.VendorItemId]
			isMapped := 0
			if mapped {
				isMapped = 1
			}
			database.DB.Exec(`
				INSERT INTO inventory (user_id, vendor_item_id, seller_product_id, product_name, item_name, status_name,
					stock_quantity, sales_last_30_days, is_mapped, synced_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
				ON CONFLICT(user_id, vendor_item_id) DO UPDATE SET
					seller_product_id = excluded.seller_product_id,
					product_name = excluded.product_name,
					item_name = excluded.item_name,
					status_name = excluded.status_name,
					stock_quantity = excluded.stock_quantity,
					sales_last_30_days = excluded.sales_last_30_days,
					is_mapped = excluded.is_mapped,
					synced_at = CURRENT_TIMESTAMP
			`, user.UserID, inv.VendorItemId, info.SellerProductId, info.ProductName, info.ItemName, info.StatusName,
				inv.InventoryDetails.TotalOrderableQuantity, inv.SalesCountMap.Last30Days, isMapped)
			invCount++
		}
		upsertSyncStatus(user.UserID, "inventory", invCount)
	}

	syncedAt := time.Now().UTC().Format("2006-01-02T15:04:05Z")
	return c.JSON(http.StatusOK, map[string]interface{}{
		"code":         "SUCCESS",
		"productCount": productCount,
		"itemCount":    itemCount,
		"invCount":     invCount,
		"syncedAt":     syncedAt,
	})
}

// syncInventory: 쿠팡 재고 API 호출 → inventory 테이블 저장
func syncInventory(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)
	client := coupang.NewClient(user.VendorID, user.AccessKey, user.SecretKey)

	invRawItems, err := client.GetInventorySummaries()
	if err != nil {
		c.Logger().Errorf("syncInventory GetInventorySummaries failed: %v", err)
		errMsg := err.Error()
		if strings.Contains(errMsg, "429") {
			return c.JSON(http.StatusTooManyRequests, map[string]string{"error": "쿠팡 API 요청 한도 초과. 잠시 후 다시 시도해주세요."})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
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

	// 재고 API 응답에서 sellerProductId 수집 → product_items에 없으면 상품 단건 조회 후 등록
	type RgSyncItemData struct {
		VendorItemId int64 `json:"vendorItemId"`
		ItemId       int64 `json:"itemId"`
	}
	type SyncDetailProductItem struct {
		ItemName              string          `json:"itemName"`
		SellerProductItemName string          `json:"sellerProductItemName"`
		ExternalVendorSku     string          `json:"externalVendorSku"`
		OriginalPrice         float64         `json:"originalPrice"`
		SalePrice             float64         `json:"salePrice"`
		StatusName            string          `json:"statusName"`
		RocketGrowthItemData  *RgSyncItemData `json:"rocketGrowthItemData"`
	}
	type SyncDetailProduct struct {
		SellerProductId   int64                  `json:"sellerProductId"`
		SellerProductName string                 `json:"sellerProductName"`
		Brand             string                 `json:"brand"`
		StatusName        string                 `json:"statusName"`
		Items             []SyncDetailProductItem `json:"items"`
	}
	type SyncDetailResp struct {
		Code string            `json:"code"`
		Data SyncDetailProduct `json:"data"`
	}

	// 재고 응답의 sellerProductId 중 product_items 미등록 항목 수집
	type InvSellerProduct struct {
		VendorItemId    int64 `json:"vendorItemId"`
		SellerProductId int64 `json:"sellerProductId"`
	}
	missingSellerIds := map[int64]bool{}
	for _, raw := range invRawItems {
		var it InvSellerProduct
		if err := json.Unmarshal(raw, &it); err != nil || it.SellerProductId == 0 {
			continue
		}
		var exists int
		database.DB.QueryRow(
			`SELECT COUNT(*) FROM product_items WHERE user_id=? AND seller_product_id=?`,
			user.UserID, it.SellerProductId,
		).Scan(&exists)
		if exists == 0 {
			missingSellerIds[it.SellerProductId] = true
		}
	}
	// 미등록 상품 단건 조회 → products + product_items 저장
	for sellerProductId := range missingSellerIds {
		detailBody, err := client.GetProductDetail(sellerProductId)
		if err != nil {
			continue
		}
		var dr SyncDetailResp
		if err := json.Unmarshal(detailBody, &dr); err != nil || dr.Data.SellerProductId == 0 {
			continue
		}
		p := dr.Data
		database.DB.Exec(`
			INSERT INTO products (user_id, seller_product_id, seller_product_name, brand, status_name, synced_at)
			VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
			ON CONFLICT(user_id, seller_product_id) DO UPDATE SET
				seller_product_name = excluded.seller_product_name,
				brand = excluded.brand,
				status_name = excluded.status_name,
				synced_at = CURRENT_TIMESTAMP`,
			user.UserID, p.SellerProductId, p.SellerProductName, p.Brand, p.StatusName)
		for _, it := range p.Items {
			if it.RocketGrowthItemData == nil || it.RocketGrowthItemData.ItemId == 0 {
				continue
			}
			database.DB.Exec(`
				INSERT INTO product_items (user_id, seller_product_id, item_id, item_name,
					seller_product_item_name, external_vendor_sku, original_price, sale_price,
					status_name, vendor_item_id, synced_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
				ON CONFLICT(user_id, item_id) DO UPDATE SET
					item_name = excluded.item_name,
					seller_product_item_name = excluded.seller_product_item_name,
					external_vendor_sku = excluded.external_vendor_sku,
					status_name = excluded.status_name,
					vendor_item_id = excluded.vendor_item_id,
					synced_at = CURRENT_TIMESTAMP`,
				user.UserID, p.SellerProductId, it.RocketGrowthItemData.ItemId, it.ItemName,
				it.SellerProductItemName, it.ExternalVendorSku, it.OriginalPrice, it.SalePrice,
				it.StatusName, it.RocketGrowthItemData.VendorItemId)
		}
	}

	// product_items에서 vendorItemId → 상품명/아이템명/seller_product_id 매핑
	type ItemInfo struct {
		SellerProductId int64
		ProductName     string
		ItemName        string
		StatusName      string
	}
	itemMap := make(map[int64]ItemInfo)
	rows, err := database.DB.Query(`
		SELECT pi.vendor_item_id, pi.seller_product_id, p.seller_product_name, pi.item_name, pi.status_name
		FROM product_items pi
		JOIN products p ON p.user_id = pi.user_id AND p.seller_product_id = pi.seller_product_id
		WHERE pi.user_id = ? AND pi.vendor_item_id > 0
	`, user.UserID)
	if err == nil {
		for rows.Next() {
			var vid, spid int64
			var pname, iname, sname string
			if rows.Scan(&vid, &spid, &pname, &iname, &sname) == nil {
				itemMap[vid] = ItemInfo{SellerProductId: spid, ProductName: pname, ItemName: iname, StatusName: sname}
			}
		}
		rows.Close()
	}

	count := 0
	for _, raw := range invRawItems {
		var inv InvSummaryItem
		if err := json.Unmarshal(raw, &inv); err != nil {
			continue
		}

		info, mapped := itemMap[inv.VendorItemId]
		isMapped := 0
		if mapped {
			isMapped = 1
		}

		_, err := database.DB.Exec(`
			INSERT INTO inventory (user_id, vendor_item_id, seller_product_id, product_name, item_name, status_name,
				stock_quantity, sales_last_30_days, is_mapped, synced_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
			ON CONFLICT(user_id, vendor_item_id) DO UPDATE SET
				seller_product_id = excluded.seller_product_id,
				product_name = excluded.product_name,
				item_name = excluded.item_name,
				status_name = excluded.status_name,
				stock_quantity = excluded.stock_quantity,
				sales_last_30_days = excluded.sales_last_30_days,
				is_mapped = excluded.is_mapped,
				synced_at = CURRENT_TIMESTAMP
		`, user.UserID, inv.VendorItemId, info.SellerProductId, info.ProductName, info.ItemName, info.StatusName,
			inv.InventoryDetails.TotalOrderableQuantity, inv.SalesCountMap.Last30Days, isMapped)
		if err != nil {
			c.Logger().Errorf("inventory upsert failed: %v", err)
			continue
		}
		count++
	}

	upsertSyncStatus(user.UserID, "inventory", count)

	syncedAt := time.Now().UTC().Format("2006-01-02T15:04:05Z")
	return c.JSON(http.StatusOK, map[string]interface{}{
		"code":     "SUCCESS",
		"count":    count,
		"syncedAt": syncedAt,
	})
}

// syncOrders: 쿠팡 주문 API 호출 → orders + order_items 테이블 저장
// fromDate, toDate 쿼리 파라미터로 날짜 범위 지정
// force=true 이면 해당 기간 기존 데이터 삭제 후 재동기화
func syncOrders(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)
	client := coupang.NewClient(user.VendorID, user.AccessKey, user.SecretKey)

	now := time.Now()
	fromStr := c.QueryParam("fromDate")
	toStr := c.QueryParam("toDate")
	force := c.QueryParam("force") == "true"

	if fromStr == "" || toStr == "" {
		toStr = now.Format("2006-01-02")
		lastSynced := getLastSyncedAt(user.UserID, "orders")
		if lastSynced != "" {
			t, err := time.Parse("2006-01-02T15:04:05Z", lastSynced)
			if err != nil {
				t, err = time.Parse("2006-01-02T15:04:05", lastSynced)
			}
			if err == nil {
				fromStr = t.Format("2006-01-02")
			}
		}
		if fromStr == "" {
			fromStr = now.AddDate(0, 0, -90).Format("2006-01-02")
		}
	}

	// orders 테이블에서 이미 동기화된 paid_at 날짜 범위 확인
	var dbMinDate, dbMaxDate string
	database.DB.QueryRow(
		`SELECT COALESCE(MIN(substr(paid_at,1,10)),''), COALESCE(MAX(substr(paid_at,1,10)),'')
		 FROM orders WHERE user_id = ?`,
		user.UserID,
	).Scan(&dbMinDate, &dbMaxDate)

	// 겹치는 구간 계산
	overlapFrom, overlapTo := "", ""
	if dbMinDate != "" && dbMaxDate != "" {
		// 겹침: max(reqFrom, dbMin) ~ min(reqTo, dbMax)
		oFrom := fromStr
		if dbMinDate > oFrom {
			oFrom = dbMinDate
		}
		oTo := toStr
		if dbMaxDate < oTo {
			oTo = dbMaxDate
		}
		if oFrom <= oTo {
			overlapFrom = oFrom
			overlapTo = oTo
		}
	}

	hasOverlap := overlapFrom != ""

	// 겹치는 구간이 있고 force가 아닌 경우 → 프론트에 확인 요청
	if hasOverlap && !force {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"code":        "OVERLAP_DETECTED",
			"overlapFrom": overlapFrom,
			"overlapTo":   overlapTo,
			"fromDate":    fromStr,
			"toDate":      toStr,
		})
	}

	// API 호출 시 ±1일 여유를 두어 UTC/KST 경계 주문 누락 방지
	apiFrom := fromStr
	apiTo := toStr
	if t, err := time.Parse("2006-01-02", fromStr); err == nil {
		apiFrom = t.AddDate(0, 0, -1).Format("2006-01-02")
	}
	if t, err := time.Parse("2006-01-02", toStr); err == nil {
		apiTo = t.AddDate(0, 0, 1).Format("2006-01-02")
	}
	syncFrom := fromStr
	syncTo := toStr

	// force=true: 삭제 범위를 apiFrom~apiTo(±1일)와 일치시켜 경계 데이터 누락 방지
	if hasOverlap && force {
		database.DB.Exec(
			`DELETE FROM order_items WHERE user_id = ? AND order_id IN (
				SELECT order_id FROM orders WHERE user_id = ? AND substr(paid_at,1,10) >= ? AND substr(paid_at,1,10) <= ?
			)`,
			user.UserID, user.UserID, apiFrom, apiTo,
		)
		database.DB.Exec(
			`DELETE FROM orders WHERE user_id = ? AND substr(paid_at,1,10) >= ? AND substr(paid_at,1,10) <= ?`,
			user.UserID, apiFrom, apiTo,
		)
	}

	data, err := client.GetOrders(apiFrom, apiTo)
	if err != nil {
		c.Logger().Errorf("syncOrders GetOrders failed: %v", err)
		if strings.Contains(err.Error(), "429") {
			return c.JSON(http.StatusTooManyRequests, map[string]string{"error": "쿠팡 API 요청 한도 초과. 잠시 후 다시 시도해주세요."})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	type OrderItem struct {
		VendorItemId   int64  `json:"vendorItemId"`
		ProductName    string `json:"productName"`
		SalesQuantity  int    `json:"salesQuantity"`
		UnitSalesPrice string `json:"unitSalesPrice"`
	}
	type Order struct {
		OrderId    int64       `json:"orderId"`
		PaidAt     int64       `json:"paidAt"`
		OrderItems []OrderItem `json:"orderItems"`
	}
	type OrdersResp struct {
		Code string  `json:"code"`
		Data []Order `json:"data"`
	}

	var ordersResp OrdersResp
	if err := json.Unmarshal(data, &ordersResp); err != nil {
		c.Logger().Errorf("syncOrders Unmarshal failed: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "응답 파싱 실패"})
	}

	orderCount := 0
	for _, o := range ordersResp.Data {
		paidAtStr := time.Unix(o.PaidAt/1000, 0).UTC().Format("2006-01-02T15:04:05Z")

		_, err := database.DB.Exec(`
			INSERT INTO orders (user_id, order_id, paid_at, synced_at)
			VALUES (?, ?, ?, CURRENT_TIMESTAMP)
			ON CONFLICT(user_id, order_id) DO UPDATE SET
				paid_at = excluded.paid_at,
				synced_at = CURRENT_TIMESTAMP
		`, user.UserID, o.OrderId, paidAtStr)
		if err != nil {
			c.Logger().Errorf("orders upsert failed: %v", err)
			continue
		}

		database.DB.Exec("DELETE FROM order_items WHERE user_id = ? AND order_id = ?", user.UserID, o.OrderId)
		for _, oi := range o.OrderItems {
			var unitPrice float64
			fmt.Sscanf(oi.UnitSalesPrice, "%f", &unitPrice)
			database.DB.Exec(`
				INSERT INTO order_items (user_id, order_id, vendor_item_id, product_name, sales_quantity, unit_price, sales_price)
				VALUES (?, ?, ?, ?, ?, ?, ?)
			`, user.UserID, o.OrderId, oi.VendorItemId, oi.ProductName, oi.SalesQuantity, unitPrice, unitPrice)
		}
		orderCount++
	}

	upsertSyncStatus(user.UserID, "orders", orderCount)

	syncedAt := time.Now().UTC().Format("2006-01-02T15:04:05Z")
	return c.JSON(http.StatusOK, map[string]interface{}{
		"code":     "SUCCESS",
		"count":    orderCount,
		"syncedAt": syncedAt,
		"fromDate": syncFrom,
		"toDate":   syncTo,
	})
}

// syncReturns: 쿠팡 반품 API 호출 → returns 테이블 저장
// 마지막 동기화 이후 시점부터 현재까지 자동 계산
func syncReturns(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)
	client := coupang.NewClient(user.VendorID, user.AccessKey, user.SecretKey)

	now := time.Now()
	toStr := now.Format("2006-01-02T15:04")

	// DB에 실제 데이터가 있는 경우만 마지막 동기화 시각부터 조회
	var returnCount int
	database.DB.QueryRow("SELECT COUNT(*) FROM returns WHERE user_id = ?", user.UserID).Scan(&returnCount)

	lastSynced := getLastSyncedAt(user.UserID, "returns")
	var fromStr string
	if lastSynced != "" && returnCount > 0 {
		t, err := time.Parse("2006-01-02T15:04:05Z", lastSynced)
		if err != nil {
			t, err = time.Parse("2006-01-02T15:04:05", lastSynced)
		}
		if err == nil {
			fromStr = t.Format("2006-01-02T15:04")
		}
	}
	if fromStr == "" {
		// 최초 동기화 or 데이터 없음: 90일치 (31일 단위로 나눠서 요청)
		fromStr = now.AddDate(0, 0, -90).Format("2006-01-02T00:00")
	}

	// 반품 API 최대 조회 기간: 31일 → 청크 단위로 분할 요청
	path := fmt.Sprintf("/v2/providers/openapi/apis/api/v6/vendors/%s/returnRequests", user.VendorID)

	fromTime, err := time.Parse("2006-01-02T15:04", fromStr)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "날짜 파싱 실패: " + fromStr})
	}
	toTime, err := time.Parse("2006-01-02T15:04", toStr)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "날짜 파싱 실패: " + toStr})
	}

	type ReturnsResp struct {
		Code json.RawMessage   `json:"code"`
		Data []json.RawMessage `json:"data"`
	}

	var allRawData []json.RawMessage
	chunkFrom := fromTime
	chunkIdx := 0
	for chunkFrom.Before(toTime) {
		if chunkIdx > 0 {
			time.Sleep(500 * time.Millisecond)
		}
		chunkIdx++

		chunkTo := chunkFrom.Add(31 * 24 * time.Hour)
		if chunkTo.After(toTime) {
			chunkTo = toTime
		}

		query := fmt.Sprintf("searchType=timeFrame&createdAtFrom=%s&createdAtTo=%s",
			chunkFrom.Format("2006-01-02T15:04"),
			chunkTo.Format("2006-01-02T15:04"),
		)

		body, err := client.Request("GET", path, query)
		if err != nil {
			c.Logger().Errorf("syncReturns API failed: %v", err)
			errMsg := err.Error()
			if strings.Contains(errMsg, "429") {
				return c.JSON(http.StatusTooManyRequests, map[string]string{"error": "쿠팡 API 요청 한도 초과. 잠시 후 다시 시도해주세요."})
			}
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}

		var chunk ReturnsResp
		if err := json.Unmarshal(body, &chunk); err != nil {
			c.Logger().Errorf("syncReturns parse failed: %s", string(body))
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "응답 파싱 실패: " + err.Error()})
		}
		c.Logger().Errorf("syncReturns chunk %d items=%d body=%.300s", chunkIdx, len(chunk.Data), string(body))
		allRawData = append(allRawData, chunk.Data...)

		chunkFrom = chunkTo
	}

	// 실제 쿠팡 API 응답 구조
	type ReturnItemDetail struct {
		VendorItemId      int64  `json:"vendorItemId"`
		VendorItemName    string `json:"vendorItemName"`
		SellerProductId   int64  `json:"sellerProductId"`
		SellerProductName string `json:"sellerProductName"`
		CancelCount       int    `json:"cancelCount"`
		PurchaseCount     int    `json:"purchaseCount"`
	}
	type ReturnReceipt struct {
		ReceiptId       int64              `json:"receiptId"`
		OrderId         int64              `json:"orderId"`
		ReceiptStatus   string             `json:"receiptStatus"`
		CreatedAt       string             `json:"createdAt"`
		ModifiedAt      string             `json:"modifiedAt"`
		CancelReason    string             `json:"cancelReason"`
		ReasonCode      string             `json:"reasonCode"`
		ReasonCodeText  string             `json:"reasonCodeText"`
		CancelCountSum  int                `json:"cancelCountSum"`
		ReturnItems     []ReturnItemDetail `json:"returnItems"`
	}

	// receiptStatus 코드 → 표시용 상태값 매핑
	statusCodeMap := map[string]string{
		"RELEASE_STOP_UNCHECKED": "RU",
		"RETURNS_UNCHECKED":      "UC",
		"VENDOR_WAREHOUSE_CONFIRM": "UC",
		"REQUEST_COUPANG_CHECK":  "PR",
		"RETURNS_COMPLETED":      "CC",
	}

	count := 0
	for _, raw := range allRawData {
		var r ReturnReceipt
		if err := json.Unmarshal(raw, &r); err != nil {
			continue
		}
		rawStr := string(raw)
		statusCode := statusCodeMap[r.ReceiptStatus]
		if statusCode == "" {
			statusCode = r.ReceiptStatus
		}

		// returnItems에서 첫 번째 아이템 정보 사용
		var vendorItemId int64
		var productName, itemName string
		var returnCount int
		if len(r.ReturnItems) > 0 {
			first := r.ReturnItems[0]
			vendorItemId = first.VendorItemId
			productName = first.SellerProductName
			itemName = first.VendorItemName
			returnCount = first.CancelCount
		}
		if returnCount == 0 {
			returnCount = r.CancelCountSum
		}

		_, err := database.DB.Exec(`
			INSERT INTO returns (user_id, receipt_id, order_id, status, status_name, product_name,
				item_name, vendor_item_id, return_count, sales_quantity, return_reason, return_reason_code,
				created_at_api, cancelled_at, returned_at, raw_json, synced_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
			ON CONFLICT(user_id, receipt_id) DO UPDATE SET
				status = excluded.status,
				status_name = excluded.status_name,
				product_name = excluded.product_name,
				item_name = excluded.item_name,
				vendor_item_id = excluded.vendor_item_id,
				return_count = excluded.return_count,
				sales_quantity = excluded.sales_quantity,
				return_reason = excluded.return_reason,
				return_reason_code = excluded.return_reason_code,
				created_at_api = excluded.created_at_api,
				cancelled_at = excluded.cancelled_at,
				returned_at = excluded.returned_at,
				raw_json = excluded.raw_json,
				synced_at = CURRENT_TIMESTAMP
		`, user.UserID, r.ReceiptId, r.OrderId, statusCode, r.ReceiptStatus, productName,
			itemName, vendorItemId, returnCount, 0, r.CancelReason, r.ReasonCode,
			r.CreatedAt, r.ModifiedAt, r.ModifiedAt, rawStr)
		if err != nil {
			c.Logger().Errorf("returns upsert failed: %v", err)
			continue
		}
		count++
	}

	upsertSyncStatus(user.UserID, "returns", count)

	syncedAt := time.Now().UTC().Format("2006-01-02T15:04:05Z")
	return c.JSON(http.StatusOK, map[string]interface{}{
		"code":      "SUCCESS",
		"count":     count,
		"syncedAt":  syncedAt,
		"fromDate":  fromStr,
		"toDate":    toStr,
	})
}

// getSyncStatus: 모든 데이터 타입의 동기화 상태 반환
func getSyncStatus(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)

	type SyncInfo struct {
		DataType      string `json:"dataType"`
		LastSyncedAt  string `json:"lastSyncedAt"`
		RecordCount   int    `json:"recordCount"`
	}

	rows, err := database.DB.Query(`
		SELECT data_type, COALESCE(last_synced_at, ''), record_count
		FROM sync_status
		WHERE user_id = ?
		ORDER BY data_type
	`, user.UserID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "DB 조회 실패"})
	}
	defer rows.Close()

	statusMap := map[string]SyncInfo{}
	for rows.Next() {
		var s SyncInfo
		if err := rows.Scan(&s.DataType, &s.LastSyncedAt, &s.RecordCount); err == nil {
			statusMap[s.DataType] = s
		}
	}

	// 기본값 채우기 (한번도 동기화 안 한 경우)
	for _, dt := range []string{"products", "inventory", "orders", "returns"} {
		if _, ok := statusMap[dt]; !ok {
			statusMap[dt] = SyncInfo{DataType: dt, LastSyncedAt: "", RecordCount: 0}
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"code": "SUCCESS",
		"data": statusMap,
	})
}

// ─── 배치 관리 ────────────────────────────────────────────────

var batchJobDefs = []map[string]string{
	{"job_type": "products", "job_name": "상품관리 동기화"},
	{"job_type": "orders", "job_name": "주문관리 동기화"},
	{"job_type": "inventory", "job_name": "재고관리 동기화"},
}

// getBatchJobs: 배치 작업 목록 + 마지막 실행 정보 반환
func getBatchJobs(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)

	type BatchJob struct {
		JobType     string `json:"jobType"`
		JobName     string `json:"jobName"`
		LastStatus  string `json:"lastStatus"`
		LastRanAt   string `json:"lastRanAt"`
		LastMessage string `json:"lastMessage"`
		RecordCount int    `json:"recordCount"`
	}

	var jobs []BatchJob
	for _, def := range batchJobDefs {
		job := BatchJob{JobType: def["job_type"], JobName: def["job_name"]}
		database.DB.QueryRow(`
			SELECT status, started_at, message, record_count
			FROM batch_logs WHERE user_id = ? AND job_type = ?
			ORDER BY id DESC LIMIT 1`,
			user.UserID, def["job_type"],
		).Scan(&job.LastStatus, &job.LastRanAt, &job.LastMessage, &job.RecordCount)
		jobs = append(jobs, job)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"code": "SUCCESS", "data": jobs})
}

// runBatchJob: 특정 배치 수동 실행
func runBatchJob(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)
	jobType := c.Param("jobType")

	validJobs := map[string]bool{"products": true, "inventory": true, "orders": true}
	if !validJobs[jobType] {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "유효하지 않은 배치 타입"})
	}

	// 주문 동기화: 날짜 파라미터 수신 (없으면 전일자 기본값)
	fromDate := c.QueryParam("fromDate")
	toDate := c.QueryParam("toDate")

	go executeBatchJob(user.UserID, user.VendorID, user.AccessKey, user.SecretKey, jobType, "manual", fromDate, toDate)

	return c.JSON(http.StatusOK, map[string]interface{}{"code": "SUCCESS", "message": "배치 실행 시작"})
}

// getBatchLogs: 배치 실행 로그 조회
func getBatchLogs(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)
	jobType := c.QueryParam("jobType")

	query := `SELECT id, job_type, triggered_by, status, message, record_count, started_at, COALESCE(finished_at,''), COALESCE(from_date,''), COALESCE(to_date,'')
		FROM batch_logs WHERE user_id = ?`
	args := []interface{}{user.UserID}
	if jobType != "" {
		query += " AND job_type = ?"
		args = append(args, jobType)
	}
	query += " ORDER BY id DESC LIMIT 50"

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "DB 조회 실패"})
	}
	defer rows.Close()

	type BatchLog struct {
		ID          int    `json:"id"`
		JobType     string `json:"jobType"`
		TriggeredBy string `json:"triggeredBy"`
		Status      string `json:"status"`
		Message     string `json:"message"`
		RecordCount int    `json:"recordCount"`
		StartedAt   string `json:"startedAt"`
		FinishedAt  string `json:"finishedAt"`
		FromDate    string `json:"fromDate"`
		ToDate      string `json:"toDate"`
	}
	var logs []BatchLog
	for rows.Next() {
		var l BatchLog
		rows.Scan(&l.ID, &l.JobType, &l.TriggeredBy, &l.Status, &l.Message, &l.RecordCount, &l.StartedAt, &l.FinishedAt, &l.FromDate, &l.ToDate)
		logs = append(logs, l)
	}
	if logs == nil {
		logs = []BatchLog{}
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"code": "SUCCESS", "data": logs})
}

// executeBatchJob: 실제 배치 실행
func executeBatchJob(userID int64, vendorID, accessKey, secretKey, jobType, triggeredBy string, dateParts ...string) {
	res, err := database.DB.Exec(`
		INSERT INTO batch_logs (user_id, job_type, triggered_by, status, message, started_at)
		VALUES (?, ?, ?, 'running', '', CURRENT_TIMESTAMP)`,
		userID, jobType, triggeredBy,
	)
	if err != nil {
		return
	}
	logID, _ := res.LastInsertId()

	finishLog := func(status, message string, count int) {
		database.DB.Exec(`
			UPDATE batch_logs SET status=?, message=?, record_count=?, finished_at=CURRENT_TIMESTAMP
			WHERE id=?`, status, message, count, logID)
	}

	client := coupang.NewClient(vendorID, accessKey, secretKey)
	now := time.Now()
	yesterday := now.AddDate(0, 0, -1)
	// 날짜 파라미터가 있으면 사용, 없으면 전일자 기본값
	fromDate := yesterday.Format("2006-01-02") + "T00:00:00"
	toDate := yesterday.Format("2006-01-02") + "T23:59:59"
	if len(dateParts) >= 1 && dateParts[0] != "" {
		fromDate = dateParts[0] + "T00:00:00"
	}
	if len(dateParts) >= 2 && dateParts[1] != "" {
		toDate = dateParts[1] + "T23:59:59"
	}

	switch jobType {
	case "products":
		count, err := batchSyncProducts(userID, client)
		if err != nil {
			finishLog("failed", err.Error(), 0)
		} else {
			upsertSyncStatus(userID, "products", count)
			finishLog("success", fmt.Sprintf("상품 %d건 동기화 완료", count), count)
		}
	case "inventory":
		count, err := batchSyncInventory(userID, client)
		if err != nil {
			finishLog("failed", err.Error(), 0)
		} else {
			upsertSyncStatus(userID, "inventory", count)
			finishLog("success", fmt.Sprintf("재고 %d건 동기화 완료", count), count)
		}
	case "orders":
		count, err := batchSyncOrders(userID, vendorID, client, fromDate, toDate)
		if err != nil {
			finishLog("failed", err.Error(), 0)
		} else {
			upsertSyncStatus(userID, "orders", count)
			finishLog("success", fmt.Sprintf("주문 %d건 동기화 완료 (%s ~ %s)", count, fromDate[:10], toDate[:10]), count)
		}
	}
}

// batchSyncProducts: 상품 동기화
func batchSyncProducts(userID int64, client *coupang.Client) (int, error) {
	path := "/v2/providers/seller_api/apis/api/v1/marketplace/seller-products"
	query := fmt.Sprintf("vendorId=%s&nextToken=&maxPerPage=100&status=APPROVED", client.VendorID)
	body, err := client.Request("GET", path, query)
	if err != nil {
		return 0, err
	}
	var resp struct {
		Data []json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return 0, fmt.Errorf("응답 파싱 실패")
	}
	type ProductItem struct {
		SellerProductId     int64  `json:"sellerProductId"`
		SellerProductName   string `json:"sellerProductName"`
		Brand               string `json:"brand"`
		StatusName          string `json:"statusName"`
		SaleStartedAt       string `json:"saleStartedAt"`
		SaleEndedAt         string `json:"saleEndedAt"`
		DisplayCategoryCode int64  `json:"displayCategoryCode"`
		CategoryId          int64  `json:"categoryId"`
		RegistrationType    string `json:"registrationType"`
	}
	count := 0
	for _, raw := range resp.Data {
		var p ProductItem
		if err := json.Unmarshal(raw, &p); err != nil {
			continue
		}
		database.DB.Exec(`
			INSERT INTO products (user_id, seller_product_id, seller_product_name, brand, status_name,
				sale_started_at, sale_ended_at, display_category_code, category_id, registration_type, synced_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
			ON CONFLICT(user_id, seller_product_id) DO UPDATE SET
				seller_product_name=excluded.seller_product_name, brand=excluded.brand,
				status_name=excluded.status_name, synced_at=CURRENT_TIMESTAMP`,
			userID, p.SellerProductId, p.SellerProductName, p.Brand, p.StatusName,
			p.SaleStartedAt, p.SaleEndedAt, p.DisplayCategoryCode, p.CategoryId, p.RegistrationType)
		count++
	}
	return count, nil
}

// batchSyncInventory: 재고 동기화
func batchSyncInventory(userID int64, client *coupang.Client) (int, error) {
	path := fmt.Sprintf("/v2/providers/rg_open_api/apis/api/v1/vendors/%s/rg/inventory/summaries", client.VendorID)
	body, err := client.Request("GET", path, "maxPerPage=100")
	if err != nil {
		return 0, err
	}
	var resp struct {
		Data struct {
			Content []json.RawMessage `json:"content"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return 0, fmt.Errorf("응답 파싱 실패")
	}
	type InvItem struct {
		VendorItemId    int64  `json:"vendorItemId"`
		SellerProductId int64  `json:"sellerProductId"`
		ProductName     string `json:"productName"`
		ItemName        string `json:"itemName"`
		StatusName      string `json:"statusName"`
		StockQuantity   int    `json:"stockQuantity"`
	}

	// product_items에 없는 sellerProductId → 상품 단건 조회 후 등록
	type RgItemData struct {
		VendorItemId int64 `json:"vendorItemId"`
		ItemId       int64 `json:"itemId"`
	}
	type DetailProductItem struct {
		ItemName              string      `json:"itemName"`
		SellerProductItemName string      `json:"sellerProductItemName"`
		ExternalVendorSku     string      `json:"externalVendorSku"`
		OriginalPrice         float64     `json:"originalPrice"`
		SalePrice             float64     `json:"salePrice"`
		StatusName            string      `json:"statusName"`
		RocketGrowthItemData  *RgItemData `json:"rocketGrowthItemData"`
	}
	type DetailProduct struct {
		SellerProductId   int64               `json:"sellerProductId"`
		SellerProductName string              `json:"sellerProductName"`
		Brand             string              `json:"brand"`
		StatusName        string              `json:"statusName"`
		Items             []DetailProductItem `json:"items"`
	}
	type DetailResp struct {
		Code string        `json:"code"`
		Data DetailProduct `json:"data"`
	}

	// 미매핑 항목의 sellerProductId 중 product_items에 없는 것을 수집
	missingProductIds := map[int64]bool{}
	for _, raw := range resp.Data.Content {
		var item InvItem
		if err := json.Unmarshal(raw, &item); err != nil || item.SellerProductId == 0 {
			continue
		}
		var exists int
		database.DB.QueryRow(
			`SELECT COUNT(*) FROM product_items WHERE user_id=? AND seller_product_id=?`,
			userID, item.SellerProductId,
		).Scan(&exists)
		if exists == 0 {
			missingProductIds[item.SellerProductId] = true
		}
	}

	// 상품 단건 조회 → products + product_items 등록
	for sellerProductId := range missingProductIds {
		detailBody, err := client.GetProductDetail(sellerProductId)
		if err != nil {
			continue
		}
		var dr DetailResp
		if err := json.Unmarshal(detailBody, &dr); err != nil || dr.Data.SellerProductId == 0 {
			continue
		}
		p := dr.Data
		// products 등록
		database.DB.Exec(`
			INSERT INTO products (user_id, seller_product_id, seller_product_name, brand, status_name, synced_at)
			VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
			ON CONFLICT(user_id, seller_product_id) DO UPDATE SET
				seller_product_name = excluded.seller_product_name,
				brand = excluded.brand,
				status_name = excluded.status_name,
				synced_at = CURRENT_TIMESTAMP`,
			userID, p.SellerProductId, p.SellerProductName, p.Brand, p.StatusName)
		// product_items 등록
		for _, it := range p.Items {
			if it.RocketGrowthItemData == nil || it.RocketGrowthItemData.ItemId == 0 {
				continue
			}
			database.DB.Exec(`
				INSERT INTO product_items (user_id, seller_product_id, item_id, item_name,
					seller_product_item_name, external_vendor_sku, original_price, sale_price,
					status_name, vendor_item_id, synced_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
				ON CONFLICT(user_id, item_id) DO UPDATE SET
					item_name = excluded.item_name,
					seller_product_item_name = excluded.seller_product_item_name,
					external_vendor_sku = excluded.external_vendor_sku,
					status_name = excluded.status_name,
					vendor_item_id = excluded.vendor_item_id,
					synced_at = CURRENT_TIMESTAMP`,
				userID, p.SellerProductId, it.RocketGrowthItemData.ItemId, it.ItemName,
				it.SellerProductItemName, it.ExternalVendorSku, it.OriginalPrice, it.SalePrice,
				it.StatusName, it.RocketGrowthItemData.VendorItemId)
		}
	}

	count := 0
	for _, raw := range resp.Data.Content {
		var item InvItem
		if err := json.Unmarshal(raw, &item); err != nil {
			continue
		}
		database.DB.Exec(`
			INSERT INTO inventory (user_id, vendor_item_id, seller_product_id, product_name, item_name, status_name, stock_quantity, created_at, synced_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
			ON CONFLICT(user_id, vendor_item_id) DO UPDATE SET
				seller_product_id = excluded.seller_product_id,
				product_name      = excluded.product_name,
				item_name         = excluded.item_name,
				status_name       = excluded.status_name,
				stock_quantity    = excluded.stock_quantity,
				synced_at         = CURRENT_TIMESTAMP,
				is_mapped = CASE
					WHEN EXISTS (
						SELECT 1 FROM product_items
						WHERE user_id = excluded.user_id
						  AND vendor_item_id = excluded.vendor_item_id
					) THEN 1 ELSE 0 END,
				out_of_stock_at = CASE
					WHEN inventory.stock_quantity > 0 AND excluded.stock_quantity = 0 THEN CURRENT_TIMESTAMP
					WHEN excluded.stock_quantity > 0 THEN NULL
					ELSE inventory.out_of_stock_at
				END`,
			userID, item.VendorItemId, item.SellerProductId, item.ProductName, item.ItemName, item.StatusName, item.StockQuantity)
		count++
	}
	return count, nil
}

// batchSyncOrders: 주문 동기화 (전일자)
func batchSyncOrders(userID int64, vendorID string, client *coupang.Client, fromDate, toDate string) (int, error) {
	path := fmt.Sprintf("/v2/providers/rg_open_api/apis/api/v1/vendors/%s/rg/orders", vendorID)
	query := fmt.Sprintf("createdAtFrom=%s&createdAtTo=%s&maxPerPage=100", fromDate, toDate)
	body, err := client.Request("GET", path, query)
	if err != nil {
		return 0, err
	}
	var resp struct {
		Data []json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return 0, fmt.Errorf("응답 파싱 실패")
	}
	type OrderItem struct {
		OrderId int64  `json:"orderId"`
		PaidAt  string `json:"paidAt"`
	}
	count := 0
	for _, raw := range resp.Data {
		var o OrderItem
		if err := json.Unmarshal(raw, &o); err != nil {
			continue
		}
		database.DB.Exec(`
			INSERT INTO orders (user_id, order_id, paid_at, synced_at)
			VALUES (?, ?, ?, CURRENT_TIMESTAMP)
			ON CONFLICT(user_id, order_id) DO UPDATE SET paid_at=excluded.paid_at, synced_at=CURRENT_TIMESTAMP`,
			userID, o.OrderId, o.PaidAt)
		count++
	}
	return count, nil
}

// getSlackWebhooks: 내 슬랙 웹훅 목록 조회
func getSlackWebhooks(c echo.Context) error {
	userID := c.Get("user").(*middleware.UserContext).UserID
	rows, err := database.DB.Query(
		`SELECT id, name, webhook_url, enabled, created_at FROM slack_webhooks WHERE user_id=? ORDER BY id ASC`, userID)
	if err != nil {
		return c.JSON(500, map[string]string{"error": err.Error()})
	}
	defer rows.Close()

	type webhook struct {
		ID         int64  `json:"id"`
		Name       string `json:"name"`
		WebhookURL string `json:"webhookUrl"`
		Enabled    bool   `json:"enabled"`
		CreatedAt  string `json:"createdAt"`
	}
	var list []webhook
	for rows.Next() {
		var w webhook
		var enabled int
		rows.Scan(&w.ID, &w.Name, &w.WebhookURL, &enabled, &w.CreatedAt)
		w.Enabled = enabled == 1
		list = append(list, w)
	}
	if list == nil {
		list = []webhook{}
	}
	return c.JSON(200, list)
}

// createSlackWebhook: 슬랙 웹훅 추가
func createSlackWebhook(c echo.Context) error {
	userID := c.Get("user").(*middleware.UserContext).UserID
	var req struct {
		Name       string `json:"name"`
		WebhookURL string `json:"webhookUrl"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(400, map[string]string{"error": "잘못된 요청"})
	}
	if req.WebhookURL == "" {
		return c.JSON(400, map[string]string{"error": "webhookUrl 필수"})
	}
	res, err := database.DB.Exec(
		`INSERT INTO slack_webhooks (user_id, name, webhook_url) VALUES (?, ?, ?)`,
		userID, req.Name, req.WebhookURL)
	if err != nil {
		return c.JSON(500, map[string]string{"error": err.Error()})
	}
	id, _ := res.LastInsertId()
	return c.JSON(201, map[string]interface{}{"id": id, "message": "추가 완료"})
}

// updateSlackWebhook: 슬랙 웹훅 수정
func updateSlackWebhook(c echo.Context) error {
	userID := c.Get("user").(*middleware.UserContext).UserID
	webhookID := c.Param("id")
	var req struct {
		Name       string `json:"name"`
		WebhookURL string `json:"webhookUrl"`
		Enabled    *bool  `json:"enabled"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(400, map[string]string{"error": "잘못된 요청"})
	}
	enabledVal := 1
	if req.Enabled != nil && !*req.Enabled {
		enabledVal = 0
	}
	_, err := database.DB.Exec(
		`UPDATE slack_webhooks SET name=?, webhook_url=?, enabled=? WHERE id=? AND user_id=?`,
		req.Name, req.WebhookURL, enabledVal, webhookID, userID)
	if err != nil {
		return c.JSON(500, map[string]string{"error": err.Error()})
	}
	return c.JSON(200, map[string]string{"message": "수정 완료"})
}

// deleteSlackWebhook: 슬랙 웹훅 삭제
func deleteSlackWebhook(c echo.Context) error {
	userID := c.Get("user").(*middleware.UserContext).UserID
	webhookID := c.Param("id")
	_, err := database.DB.Exec(
		`DELETE FROM slack_webhooks WHERE id=? AND user_id=?`, webhookID, userID)
	if err != nil {
		return c.JSON(500, map[string]string{"error": err.Error()})
	}
	return c.JSON(200, map[string]string{"message": "삭제 완료"})
}

// getSlackSettings: 슬랙 설정 조회 (폴링 간격)
func getSlackSettings(c echo.Context) error {
	userID := c.Get("user").(*middleware.UserContext).UserID
	var interval int
	err := database.DB.QueryRow(
		`SELECT polling_interval_min FROM users WHERE id=?`, userID,
	).Scan(&interval)
	if err != nil {
		interval = 10
	}
	return c.JSON(200, map[string]int{"pollingIntervalMin": interval})
}

// updateSlackSettings: 슬랙 설정 저장 (폴링 간격)
func updateSlackSettings(c echo.Context) error {
	userID := c.Get("user").(*middleware.UserContext).UserID
	var req struct {
		PollingIntervalMin int `json:"pollingIntervalMin"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(400, map[string]string{"error": "잘못된 요청"})
	}
	if req.PollingIntervalMin < 1 {
		req.PollingIntervalMin = 1
	}
	_, err := database.DB.Exec(
		`UPDATE users SET polling_interval_min=? WHERE id=?`,
		req.PollingIntervalMin, userID)
	if err != nil {
		return c.JSON(500, map[string]string{"error": err.Error()})
	}
	return c.JSON(200, map[string]string{"message": "저장 완료"})
}

// sendSlackNotification: 슬랙 웹훅으로 메시지 전송
func sendSlackNotification(webhookURL, message string) error {
	payload, _ := json.Marshal(map[string]string{"text": message})
	req, err := http.NewRequest("POST", webhookURL, bytes.NewBuffer(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("slack webhook failed: %s", string(body))
	}
	return nil
}

// sendTodaySlack: 오늘 주문 현황을 슬랙으로 즉시 발송
func sendTodaySlack(c echo.Context) error {
	userID := c.Get("user").(*middleware.UserContext).UserID
	loc, _ := time.LoadLocation("Asia/Seoul")
	now := time.Now().In(loc)
	kstMidnight := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc).UTC()
	kstTomorrow := kstMidnight.Add(24 * time.Hour)

	type orderItem struct {
		ProductName   string  `json:"product_name"`
		SalesQuantity int     `json:"sales_quantity"`
		SalesPrice    float64 `json:"sales_price"`
	}
	type orderRow struct {
		OrderID  int64     `json:"order_id"`
		PaidAt   string    `json:"paid_at"`
		Items    []orderItem
	}

	rows, err := database.DB.Query(`
		SELECT o.order_id, o.paid_at, oi.product_name, oi.sales_quantity, oi.sales_price
		FROM orders o
		LEFT JOIN order_items oi ON o.order_id = oi.order_id AND oi.user_id = o.user_id
		WHERE o.user_id = ? AND o.paid_at >= ? AND o.paid_at < ?
		ORDER BY o.paid_at ASC`,
		userID, kstMidnight.Format("2006-01-02T15:04:05Z"), kstTomorrow.Format("2006-01-02T15:04:05Z"))
	if err != nil {
		return c.JSON(500, map[string]string{"error": err.Error()})
	}
	defer rows.Close()

	orderMap := map[int64]*orderRow{}
	var orderKeys []int64
	var totalAmt float64
	for rows.Next() {
		var oid int64
		var paidAt string
		var pname string
		var qty int
		var price float64
		rows.Scan(&oid, &paidAt, &pname, &qty, &price)
		if _, ok := orderMap[oid]; !ok {
			orderMap[oid] = &orderRow{OrderID: oid, PaidAt: paidAt}
			orderKeys = append(orderKeys, oid)
		}
		if pname != "" {
			orderMap[oid].Items = append(orderMap[oid].Items, orderItem{pname, qty, price})
			totalAmt += price * float64(qty)
		}
	}

	if len(orderKeys) == 0 {
		return c.JSON(200, map[string]string{"result": "오늘 주문 없음"})
	}

	lines := []string{}
	for _, oid := range orderKeys {
		o := orderMap[oid]
		paidUTC, _ := time.Parse("2006-01-02T15:04:05Z", o.PaidAt)
		paidStr := paidUTC.In(loc).Format("01/02 15:04")
		for _, item := range o.Items {
			lines = append(lines, fmt.Sprintf("• [%s] %s / %d개 / %s원",
				paidStr, item.ProductName, item.SalesQuantity, formatComma(int64(item.SalesPrice))))
		}
	}

	msg := fmt.Sprintf("[로켓그로스] 오늘 주문 현황\n─────────────────\n%s\n─────────────────\n오늘 판매현황 : 총 %d건 / 총 %s원",
		strings.Join(lines, "\n"),
		len(orderKeys),
		formatComma(int64(totalAmt)),
	)

	whRows, err := database.DB.Query(
		`SELECT webhook_url FROM slack_webhooks WHERE user_id=? AND enabled=1`, userID)
	if err != nil {
		return c.JSON(500, map[string]string{"error": err.Error()})
	}
	var webhooks []string
	for whRows.Next() {
		var url string
		whRows.Scan(&url)
		webhooks = append(webhooks, url)
	}
	whRows.Close()
	if len(webhooks) == 0 {
		return c.JSON(400, map[string]string{"error": "등록된 슬랙 웹훅 없음"})
	}
	for _, url := range webhooks {
		if err := sendSlackNotification(url, msg); err != nil {
			return c.JSON(500, map[string]string{"error": err.Error()})
		}
	}
	return c.JSON(200, map[string]string{"result": "슬랙 발송 완료", "orders": fmt.Sprintf("%d건", len(orderKeys))})
}

// startOrderPolling: 사용자별 설정 간격마다 오늘 주문을 폴링하여 신규 주문 발생 시 슬랙 알림
func startOrderPolling(e *echo.Echo) {
	loc, _ := time.LoadLocation("Asia/Seoul")

	type userInfo struct {
		id                 int64
		vendorID           string
		accessKey          string
		secretKey          string
		pollingIntervalMin int
	}
	type orderItem struct {
		VendorItemId   int64  `json:"vendorItemId"`
		ProductName    string `json:"productName"`
		SalesQuantity  int    `json:"salesQuantity"`
		UnitSalesPrice string `json:"unitSalesPrice"`
	}
	type order struct {
		OrderId    int64       `json:"orderId"`
		PaidAt     int64       `json:"paidAt"`
		OrderItems []orderItem `json:"orderItems"`
	}

	// 1분 ticker로 돌리고 사용자별 interval 경과 여부로 실행 판단
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()
	lastRun := map[int64]time.Time{}

	for range ticker.C {
		fmt.Printf("[order polling] 틱: %s\n", time.Now().In(loc).Format("2006-01-02 15:04:05"))

		now := time.Now().In(loc)

		rows, err := database.DB.Query(`SELECT id, vendor_id, access_key, secret_key, COALESCE(polling_interval_min, 10) FROM users`)
		if err != nil {
			e.Logger.Errorf("[order polling] 사용자 조회 실패: %v", err)
			continue
		}
		var users []userInfo
		for rows.Next() {
			var u userInfo
			rows.Scan(&u.id, &u.vendorID, &u.accessKey, &u.secretKey, &u.pollingIntervalMin)
			if u.vendorID != "" && u.accessKey != "" {
				users = append(users, u)
			}
		}
		rows.Close()

		for _, u := range users {
			// 사용자별 폴링 간격 경과 여부 확인
			interval := time.Duration(u.pollingIntervalMin) * time.Minute
			if last, ok := lastRun[u.id]; ok && time.Since(last) < interval {
				continue
			}
			lastRun[u.id] = time.Now()
			fmt.Printf("[order polling] 폴링 실행 user=%d interval=%dm\n", u.id, u.pollingIntervalMin)

			// 1. DB에서 ±1일 범위 기존 order_id 목록 조회 (API 호출 범위와 동일하게 맞춤)
			kstMidnight := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc).UTC()
			kstTomorrow := kstMidnight.Add(24 * time.Hour)
			apiRangeFrom := kstMidnight.Add(-24 * time.Hour)
			apiRangeTo := kstTomorrow.Add(24 * time.Hour)
			existRows, err := database.DB.Query(
				`SELECT order_id FROM orders WHERE user_id = ? AND paid_at >= ? AND paid_at < ?`,
				u.id, apiRangeFrom.Format("2006-01-02T15:04:05Z"), apiRangeTo.Format("2006-01-02T15:04:05Z"),
			)
			if err != nil {
				e.Logger.Errorf("[order polling] 기존 주문 조회 실패 user=%d: %v", u.id, err)
				continue
			}
			existingIDs := map[int64]bool{}
			for existRows.Next() {
				var oid int64
				existRows.Scan(&oid)
				existingIDs[oid] = true
			}
			existRows.Close()

			// 2. 쿠팡 API 호출 — KST 오늘 ±1일 (UTC 경계 주문 누락 방지)
			client := coupang.NewClient(u.vendorID, u.accessKey, u.secretKey)
			yesterdayStr := now.AddDate(0, 0, -1).Format("2006-01-02")
			tomorrowStr := now.AddDate(0, 0, 1).Format("2006-01-02")
			body, err := client.GetOrders(yesterdayStr, tomorrowStr)
			if err != nil {
				fmt.Printf("[order polling] API 호출 실패 user=%d: %v\n", u.id, err)
				continue
			}

			var resp struct {
				Data []json.RawMessage `json:"data"`
			}
			if err := json.Unmarshal(body, &resp); err != nil {
				fmt.Printf("[order polling] 응답 파싱 실패 user=%d: %v\n", u.id, err)
				continue
			}
			fmt.Printf("[order polling] API 주문 건수 user=%d: %d건\n", u.id, len(resp.Data))

			// 3. 신규 주문 감지 및 DB 저장
			var newOrders []order
			for _, raw := range resp.Data {
				var o order
				if err := json.Unmarshal(raw, &o); err != nil {
					continue
				}
				paidAtStr := time.Unix(o.PaidAt/1000, 0).UTC().Format("2006-01-02T15:04:05Z")
				// DB upsert (항상 최신 상태 유지)
				database.DB.Exec(`
					INSERT INTO orders (user_id, order_id, paid_at, synced_at)
					VALUES (?, ?, ?, CURRENT_TIMESTAMP)
					ON CONFLICT(user_id, order_id) DO UPDATE SET paid_at=excluded.paid_at, synced_at=CURRENT_TIMESTAMP`,
					u.id, o.OrderId, paidAtStr)
				database.DB.Exec("DELETE FROM order_items WHERE user_id = ? AND order_id = ?", u.id, o.OrderId)
				for _, oi := range o.OrderItems {
					var unitPrice float64
					fmt.Sscanf(oi.UnitSalesPrice, "%f", &unitPrice)
					database.DB.Exec(`
						INSERT INTO order_items (user_id, order_id, vendor_item_id, product_name, sales_quantity, unit_price, sales_price)
						VALUES (?, ?, ?, ?, ?, ?, ?)`,
						u.id, o.OrderId, oi.VendorItemId, oi.ProductName, oi.SalesQuantity, unitPrice, unitPrice)
				}
				// 신규 주문만 알림 대상에 추가
				if !existingIDs[o.OrderId] {
					newOrders = append(newOrders, o)
				}
			}

			// 3-1. 폴링 실행 이력 저장
			database.DB.Exec(`
				INSERT INTO batch_logs (user_id, job_type, triggered_by, status, message, record_count, from_date, to_date, started_at, finished_at)
				VALUES (?, 'polling', 'scheduler', 'success', '', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
				u.id, len(resp.Data), yesterdayStr, tomorrowStr)

			// 4. 오늘 전체 판매현황 집계 (DB에서 조회)
			var todayTotalQty int
			var todayTotalAmt float64
			todaySumRow := database.DB.QueryRow(`
				SELECT COALESCE(SUM(oi.sales_quantity), 0), COALESCE(SUM(oi.sales_price * oi.sales_quantity), 0)
				FROM orders o
				LEFT JOIN order_items oi ON o.order_id = oi.order_id AND oi.user_id = o.user_id
				WHERE o.user_id = ? AND o.paid_at >= ? AND o.paid_at < ?`,
				u.id, kstMidnight.Format("2006-01-02T15:04:05Z"), kstTomorrow.Format("2006-01-02T15:04:05Z"))
			todaySumRow.Scan(&todayTotalQty, &todayTotalAmt)

			// 5. DB에서 사용자 슬랙 웹훅 목록 조회
			whRows, _ := database.DB.Query(
				`SELECT webhook_url FROM slack_webhooks WHERE user_id=? AND enabled=1`, u.id)
			var userWebhooks []string
			for whRows.Next() {
				var wurl string
				whRows.Scan(&wurl)
				userWebhooks = append(userWebhooks, wurl)
			}
			whRows.Close()
			if len(userWebhooks) == 0 {
				fmt.Printf("[order polling] 등록된 웹훅 없음 user=%d, 스킵\n", u.id)
				continue
			}

			// 신규 주문 없으면 슬랙 발송 생략
			if len(newOrders) == 0 {
				// [임시 비활성] 신규 주문 없어도 슬랙 발송 (폴링 동작 확인용)
				// msg := fmt.Sprintf("[로켓그로스] 신규 주문 없음\n─────────────────\n신규주문이 없습니다.\n─────────────────\n오늘 판매현황 : 총 %d건 / 총 %s원",
				// 	todayTotalCount,
				// 	formatComma(int64(todayTotalAmt)),
				// )
				// for _, wurl := range userWebhooks {
				// 	if err := sendSlackNotification(wurl, msg); err != nil {
				// 		e.Logger.Errorf("[order polling] 슬랙 알림 실패 user=%d: %v", u.id, err)
				// 	} else {
				// 		e.Logger.Infof("[order polling] 슬랙 알림 전송 완료 (신규 없음) user=%d", u.id)
				// 	}
				// }
				continue
			}

			// 6. 슬랙 메시지 작성 (KST 오늘 신규 주문만)
			todayDate := now.Format("2006-01-02") // KST 오늘 날짜
			lines := []string{}
			for _, o := range newOrders {
				paidTime := time.Unix(o.PaidAt/1000, 0).In(loc)
				// KST 기준 오늘 날짜인 경우만 포함
				if paidTime.Format("2006-01-02") != todayDate {
					continue
				}
				paidKST := paidTime.Format("01/02 15:04")
				for _, oi := range o.OrderItems {
					var price float64
					fmt.Sscanf(oi.UnitSalesPrice, "%f", &price)
					lines = append(lines, fmt.Sprintf("• [%s] %s / %d개 / %s원",
						paidKST,
						oi.ProductName,
						oi.SalesQuantity,
						formatComma(int64(price))))
				}
			}

			// KST 오늘 신규 주문 없으면 슬랙 발송 생략
			if len(lines) == 0 {
				continue
			}

			msg := fmt.Sprintf("[로켓그로스] 오늘 판매현황 : 총 %d개 / 총 %s원\n─────────────────\n%s",
				todayTotalQty,
				formatComma(int64(todayTotalAmt)),
				strings.Join(lines, "\n"),
			)

			slackSuccess := false
			for _, wurl := range userWebhooks {
				if err := sendSlackNotification(wurl, msg); err != nil {
					e.Logger.Errorf("[order polling] 슬랙 알림 실패 user=%d: %v", u.id, err)
				} else {
					e.Logger.Infof("[order polling] 슬랙 알림 전송 완료 user=%d 신규주문=%d건", u.id, len(newOrders))
					slackSuccess = true
				}
			}
			if slackSuccess {
				database.DB.Exec(`
					INSERT INTO batch_logs (user_id, job_type, triggered_by, status, message, record_count, from_date, to_date, started_at, finished_at)
					VALUES (?, 'slack', 'scheduler', 'success', ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
					u.id, fmt.Sprintf("신규 %d건", len(newOrders)), len(newOrders), yesterdayStr, tomorrowStr)
			}

			// 모바일 FCM 푸시 알림 (Slack과 동일 트리거, 서버사이드 방해금지 체크 포함)
			pushTitle := fmt.Sprintf("판매현황 총%d개/총 %s원", todayTotalQty, formatComma(int64(todayTotalAmt)))
			go func(uid int64, title string, qty int, amt float64, ls []string) {
				if err := fcm.SendToUser(database.DB, uid, title, map[string]string{
					"total_qty":    fmt.Sprintf("%d", qty),
					"total_amount": fmt.Sprintf("%.0f", amt),
				}); err != nil {
					e.Logger.Errorf("[FCM] 푸시 발송 실패 user=%d: %v", uid, err)
				}
				if err := fcm.SaveHistory(database.DB, uid, title, qty, amt, ls); err != nil {
					e.Logger.Errorf("[FCM] 히스토리 저장 실패 user=%d: %v", uid, err)
				}
			}(u.id, pushTitle, todayTotalQty, todayTotalAmt, lines)
		}
	}
}

// formatComma: 숫자를 천단위 콤마 형식으로 변환
func formatComma(n int64) string {
	s := fmt.Sprintf("%d", n)
	result := []byte{}
	for i, c := range s {
		if i > 0 && (len(s)-i)%3 == 0 {
			result = append(result, ',')
		}
		result = append(result, byte(c))
	}
	return string(result)
}

// startScheduler: 매일 KST 00:00에 모든 배치 실행
func startInventoryHourlyScheduler(e *echo.Echo) {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()
	for range ticker.C {
		rows, err := database.DB.Query(`SELECT id, vendor_id, access_key, secret_key FROM users`)
		if err != nil {
			e.Logger.Errorf("[재고 스케줄러] 사용자 조회 실패: %v", err)
			continue
		}
		type userInfo struct {
			id        int64
			vendorID  string
			accessKey string
			secretKey string
		}
		var users []userInfo
		for rows.Next() {
			var u userInfo
			rows.Scan(&u.id, &u.vendorID, &u.accessKey, &u.secretKey)
			if u.vendorID != "" && u.accessKey != "" {
				users = append(users, u)
			}
		}
		rows.Close()
		for _, u := range users {
			go executeBatchJob(u.id, u.vendorID, u.accessKey, u.secretKey, "inventory", "scheduler")
		}
	}
}

func startScheduler(e *echo.Echo) {
	loc, _ := time.LoadLocation("Asia/Seoul")
	for {
		now := time.Now().In(loc)
		next := time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 0, 0, loc)
		time.Sleep(time.Until(next))

		e.Logger.Infof("스케줄러: 배치 실행 시작 %s", time.Now().In(loc).Format("2006-01-02 15:04:05"))

		rows, err := database.DB.Query(`SELECT id, vendor_id, access_key, secret_key FROM users`)
		if err != nil {
			e.Logger.Errorf("스케줄러: 사용자 조회 실패 %v", err)
			continue
		}
		type userInfo struct {
			id        int64
			vendorID  string
			accessKey string
			secretKey string
		}
		var users []userInfo
		for rows.Next() {
			var u userInfo
			rows.Scan(&u.id, &u.vendorID, &u.accessKey, &u.secretKey)
			if u.vendorID != "" && u.accessKey != "" {
				users = append(users, u)
			}
		}
		rows.Close()

		for _, u := range users {
			for _, job := range batchJobDefs {
				go executeBatchJob(u.id, u.vendorID, u.accessKey, u.secretKey, job["job_type"], "scheduler")
				time.Sleep(2 * time.Second)
			}
		}
	}
}
