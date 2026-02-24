package main

import (
	"encoding/json"
	"fmt"
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
	"github.com/rocketgrowth/backend/internal/handlers"
	"github.com/rocketgrowth/backend/internal/middleware"
)

var cfg *config.Config

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

	// DB 조회 (동기화된 데이터 반환)
	api.GET("/coupang/products", getProductsFromDB)
	api.GET("/coupang/products/:productId/items", getProductItemsFromDB)
	api.GET("/coupang/inventory", getInventoryFromDB)
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
		ID                 int64  `json:"id"`
		SellerProductID    int64  `json:"sellerProductId"`
		SellerProductName  string `json:"sellerProductName"`
		Brand              string `json:"brand"`
		StatusName         string `json:"statusName"`
		SaleStartedAt      string `json:"saleStartedAt"`
		SaleEndedAt        string `json:"saleEndedAt"`
		DisplayCategoryCode int64  `json:"displayCategoryCode"`
		CategoryID         int64  `json:"categoryId"`
		RegistrationType   string `json:"registrationType"`
		SyncedAt           string `json:"syncedAt"`
	}

	rows, err := database.DB.Query(`
		SELECT id, seller_product_id, seller_product_name, brand, status_name,
		       sale_started_at, sale_ended_at, display_category_code, category_id,
		       registration_type, synced_at
		FROM products
		WHERE user_id = ?
		ORDER BY seller_product_id DESC
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
			&p.CategoryID, &p.RegistrationType, &p.SyncedAt); err != nil {
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

// getInventoryFromDB: DB에서 재고 목록 반환 (페이지네이션 지원)
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

	type InventoryItem struct {
		VendorItemID    int64  `json:"vendorItemId"`
		ProductName     string `json:"productName"`
		ItemName        string `json:"itemName"`
		StatusName      string `json:"statusName"`
		StockQuantity   int    `json:"stockQuantity"`
		SalesLast30Days int    `json:"salesLast30Days"`
		IsMapped        bool   `json:"isMapped"`
		SyncedAt        string `json:"syncedAt"`
	}

	// 전체 건수
	var totalCount int
	database.DB.QueryRow("SELECT COUNT(*) FROM inventory WHERE user_id = ?", user.UserID).Scan(&totalCount)

	rows, err := database.DB.Query(`
		SELECT vendor_item_id, product_name, item_name, status_name,
		       stock_quantity, sales_last_30_days, is_mapped, synced_at
		FROM inventory
		WHERE user_id = ?
		ORDER BY vendor_item_id DESC
		LIMIT ? OFFSET ?
	`, user.UserID, pageSize, (page-1)*pageSize)
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
			&isMapped, &it.SyncedAt); err != nil {
			continue
		}
		it.IsMapped = isMapped == 1
		items = append(items, it)
	}
	if items == nil {
		items = []InventoryItem{}
	}

	totalPages := (totalCount + pageSize - 1) / pageSize
	lastSynced := getLastSyncedAt(user.UserID, "inventory")

	return c.JSON(http.StatusOK, map[string]interface{}{
		"code":         "SUCCESS",
		"data":         items,
		"total":        totalCount,
		"page":         page,
		"pageSize":     pageSize,
		"totalPages":   totalPages,
		"lastSyncedAt": lastSynced,
	})
}

// getOrdersFromDB: DB에서 주문 목록 반환
func getOrdersFromDB(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)

	createdAtFrom := c.QueryParam("createdAtFrom")
	createdAtTo := c.QueryParam("createdAtTo")

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

	if createdAtFrom != "" {
		query += " AND paid_at >= ?"
		args = append(args, createdAtFrom)
	}
	if createdAtTo != "" {
		query += " AND paid_at <= ?"
		args = append(args, createdAtTo)
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
		ReceiptID       int64  `json:"receiptId"`
		OrderID         int64  `json:"orderId"`
		Status          string `json:"status"`
		StatusName      string `json:"statusName"`
		ProductName     string `json:"productName"`
		VendorItemID    int64  `json:"vendorItemId"`
		ReturnCount     int    `json:"returnCount"`
		SalesQuantity   int    `json:"salesQuantity"`
		ReturnReason    string `json:"returnReason"`
		ReturnReasonCode string `json:"returnReasonCode"`
		CreatedAtAPI    string `json:"createdAtApi"`
		CancelledAt     string `json:"cancelledAt"`
		ReturnedAt      string `json:"returnedAt"`
		SyncedAt        string `json:"syncedAt"`
	}

	query := "SELECT receipt_id, order_id, status, status_name, product_name, vendor_item_id, return_count, sales_quantity, return_reason, return_reason_code, created_at_api, cancelled_at, returned_at, synced_at FROM returns WHERE user_id = ?"
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
			&r.ProductName, &r.VendorItemID, &r.ReturnCount, &r.SalesQuantity,
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
		_, err := database.DB.Exec(`
			INSERT INTO products (user_id, seller_product_id, seller_product_name, brand, status_name,
				sale_started_at, sale_ended_at, display_category_code, category_id, registration_type, synced_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
			ON CONFLICT(user_id, seller_product_id) DO UPDATE SET
				seller_product_name = excluded.seller_product_name,
				brand = excluded.brand,
				status_name = excluded.status_name,
				sale_started_at = excluded.sale_started_at,
				sale_ended_at = excluded.sale_ended_at,
				display_category_code = excluded.display_category_code,
				category_id = excluded.category_id,
				registration_type = excluded.registration_type,
				synced_at = CURRENT_TIMESTAMP
		`, user.UserID, p.SellerProductId, p.SellerProductName, p.Brand, p.StatusName,
			p.SaleStartedAt, p.SaleEndedAt, p.DisplayCategoryCode, p.CategoryId, p.RegistrationType)
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

	// inventory 테이블의 seller_product_id 업데이트 (product_items와 vendorItemId로 매핑)
	database.DB.Exec(`
		UPDATE inventory SET seller_product_id = (
			SELECT pi.seller_product_id FROM product_items pi
			WHERE pi.user_id = inventory.user_id AND pi.vendor_item_id = inventory.vendor_item_id
			LIMIT 1
		)
		WHERE user_id = ? AND seller_product_id = 0
	`, user.UserID)

	syncedAt := time.Now().UTC().Format("2006-01-02T15:04:05Z")
	return c.JSON(http.StatusOK, map[string]interface{}{
		"code":         "SUCCESS",
		"productCount": productCount,
		"itemCount":    itemCount,
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
// 마지막 동기화 이후 시점부터 현재까지 자동 계산
func syncOrders(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)
	client := coupang.NewClient(user.VendorID, user.AccessKey, user.SecretKey)

	now := time.Now()
	toStr := now.Format("2006-01-02")

	// 마지막 동기화 시각 기반으로 from 계산
	lastSynced := getLastSyncedAt(user.UserID, "orders")
	var fromStr string
	if lastSynced != "" {
		// ISO8601 형식 파싱 (예: "2025-01-15T10:30:00Z")
		t, err := time.Parse("2006-01-02T15:04:05Z", lastSynced)
		if err != nil {
			t, err = time.Parse("2006-01-02T15:04:05", lastSynced)
		}
		if err == nil {
			fromStr = t.Format("2006-01-02")
		}
	}
	if fromStr == "" {
		// 최초 동기화: 90일치
		fromStr = now.AddDate(0, 0, -90).Format("2006-01-02")
	}

	data, err := client.GetOrders(fromStr, toStr)
	if err != nil {
		c.Logger().Errorf("syncOrders GetOrders failed: %v", err)
		errMsg := err.Error()
		if strings.Contains(errMsg, "429") {
			return c.JSON(http.StatusTooManyRequests, map[string]string{"error": "쿠팡 API 요청 한도 초과. 잠시 후 다시 시도해주세요."})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	type OrderItem struct {
		VendorItemId  int64   `json:"vendorItemId"`
		ProductName   string  `json:"productName"`
		SalesQuantity int     `json:"salesQuantity"`
		UnitPrice     float64 `json:"unitPrice"`
		SalesPrice    float64 `json:"salesPrice"`
	}
	type Order struct {
		OrderId   int64       `json:"orderId"`
		PaidAt    string      `json:"paidAt"`
		OrderItems []OrderItem `json:"orderItems"`
	}
	type OrdersResp struct {
		Code string  `json:"code"`
		Data []Order `json:"data"`
	}

	var ordersResp OrdersResp
	if err := json.Unmarshal(data, &ordersResp); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "응답 파싱 실패"})
	}

	orderCount := 0
	for _, o := range ordersResp.Data {
		// orders 테이블 upsert
		_, err := database.DB.Exec(`
			INSERT INTO orders (user_id, order_id, paid_at, synced_at)
			VALUES (?, ?, ?, CURRENT_TIMESTAMP)
			ON CONFLICT(user_id, order_id) DO UPDATE SET
				paid_at = excluded.paid_at,
				synced_at = CURRENT_TIMESTAMP
		`, user.UserID, o.OrderId, o.PaidAt)
		if err != nil {
			c.Logger().Errorf("orders upsert failed: %v", err)
			continue
		}

		// 기존 order_items 삭제 후 재삽입
		database.DB.Exec("DELETE FROM order_items WHERE user_id = ? AND order_id = ?", user.UserID, o.OrderId)
		for _, oi := range o.OrderItems {
			database.DB.Exec(`
				INSERT INTO order_items (user_id, order_id, vendor_item_id, product_name, sales_quantity, unit_price, sales_price)
				VALUES (?, ?, ?, ?, ?, ?, ?)
			`, user.UserID, o.OrderId, oi.VendorItemId, oi.ProductName, oi.SalesQuantity, oi.UnitPrice, oi.SalesPrice)
		}
		orderCount++
	}

	upsertSyncStatus(user.UserID, "orders", orderCount)

	syncedAt := time.Now().UTC().Format("2006-01-02T15:04:05Z")
	return c.JSON(http.StatusOK, map[string]interface{}{
		"code":      "SUCCESS",
		"count":     orderCount,
		"syncedAt":  syncedAt,
		"fromDate":  fromStr,
		"toDate":    toStr,
	})
}

// syncReturns: 쿠팡 반품 API 호출 → returns 테이블 저장
// 마지막 동기화 이후 시점부터 현재까지 자동 계산
func syncReturns(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)
	client := coupang.NewClient(user.VendorID, user.AccessKey, user.SecretKey)

	now := time.Now()
	toStr := now.Format("2006-01-02T15:04")

	// 마지막 동기화 시각 기반으로 from 계산
	lastSynced := getLastSyncedAt(user.UserID, "returns")
	var fromStr string
	if lastSynced != "" {
		t, err := time.Parse("2006-01-02T15:04:05Z", lastSynced)
		if err != nil {
			t, err = time.Parse("2006-01-02T15:04:05", lastSynced)
		}
		if err == nil {
			fromStr = t.Format("2006-01-02T15:04")
		}
	}
	if fromStr == "" {
		// 최초 동기화: 90일치
		fromStr = now.AddDate(0, 0, -90).Format("2006-01-02T00:00")
	}

	path := fmt.Sprintf("/v2/providers/openapi/apis/api/v6/vendors/%s/returnRequests", user.VendorID)
	query := fmt.Sprintf("searchType=timeFrame&createdAtFrom=%s&createdAtTo=%s", fromStr, toStr)

	body, err := client.Request("GET", path, query)
	if err != nil {
		c.Logger().Errorf("syncReturns API failed: %v", err)
		errMsg := err.Error()
		if strings.Contains(errMsg, "429") {
			return c.JSON(http.StatusTooManyRequests, map[string]string{"error": "쿠팡 API 요청 한도 초과. 잠시 후 다시 시도해주세요."})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	type ReturnItem struct {
		ReceiptId       int64  `json:"receiptId"`
		OrderId         int64  `json:"orderId"`
		Status          string `json:"status"`
		StatusName      string `json:"statusName"`
		ProductName     string `json:"productName"`
		VendorItemId    int64  `json:"vendorItemId"`
		ReturnCount     int    `json:"returnCount"`
		SalesQuantity   int    `json:"salesQuantity"`
		ReturnReason    string `json:"returnReason"`
		ReturnReasonCode string `json:"returnReasonCode"`
		CreatedAt       string `json:"createdAt"`
		CancelledAt     string `json:"cancelledAt"`
		ReturnedAt      string `json:"returnedAt"`
		RawJson         string
	}
	type ReturnsResp struct {
		Code string       `json:"code"`
		Data []json.RawMessage `json:"data"`
	}

	var returnsResp ReturnsResp
	if err := json.Unmarshal(body, &returnsResp); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "응답 파싱 실패"})
	}

	count := 0
	for _, raw := range returnsResp.Data {
		var r ReturnItem
		if err := json.Unmarshal(raw, &r); err != nil {
			continue
		}
		r.RawJson = string(raw)

		_, err := database.DB.Exec(`
			INSERT INTO returns (user_id, receipt_id, order_id, status, status_name, product_name,
				vendor_item_id, return_count, sales_quantity, return_reason, return_reason_code,
				created_at_api, cancelled_at, returned_at, raw_json, synced_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
			ON CONFLICT(user_id, receipt_id) DO UPDATE SET
				status = excluded.status,
				status_name = excluded.status_name,
				product_name = excluded.product_name,
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
		`, user.UserID, r.ReceiptId, r.OrderId, r.Status, r.StatusName, r.ProductName,
			r.VendorItemId, r.ReturnCount, r.SalesQuantity, r.ReturnReason, r.ReturnReasonCode,
			r.CreatedAt, r.CancelledAt, r.ReturnedAt, r.RawJson)
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

