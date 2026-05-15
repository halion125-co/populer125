package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/rocketgrowth/backend/internal/database"
	"github.com/rocketgrowth/backend/internal/forecast"
	"github.com/rocketgrowth/backend/internal/middleware"
)

// ─── 응답 구조체 ──────────────────────────────────────────────────────────────

type ForecastItem struct {
	VendorItemID                   int64   `json:"vendor_item_id"`
	ProductName                    string  `json:"product_name"`
	OptionName                     string  `json:"option_name"`
	Avg7d                          float64 `json:"avg_7d"`
	Avg14d                         float64 `json:"avg_14d"`
	Avg30d                         float64 `json:"avg_30d"`
	ForecastDailySales             float64 `json:"forecast_daily_sales"`
	CurrentStock                   int     `json:"current_stock"`
	InboundStock                   int     `json:"inbound_stock"`
	LeadTimeDays                   int     `json:"lead_time_days"`
	LeadtimeDemand                 float64 `json:"leadtime_demand"`
	SeasonEndDate                  string  `json:"season_end_date"`
	RemainingSeasonDays            int     `json:"remaining_season_days"`
	AvailableSalesDaysAfterInbound int     `json:"available_sales_days_after_inbound"`
	TargetStockDays                int     `json:"target_stock_days"`
	SafetyStockQty                 float64 `json:"safety_stock_qty"`
	RecommendedQty                 int     `json:"recommended_qty"`
	FinalOrderQty                  int     `json:"final_order_qty"`
	DaysUntilOut                   float64 `json:"days_until_out"`
	AlertLevel                     string  `json:"alert_level"`
	RecommendationStatus           string  `json:"recommendation_status"`
	Reason                         string  `json:"reason"`
	SnapshotDate                   string  `json:"snapshot_date"`
}

type ForecastConfigRequest struct {
	VendorItemID    int64   `json:"vendor_item_id"`
	LeadTimeDays    int     `json:"lead_time_days"`
	MOQ             int     `json:"moq"`
	OrderUnit       int     `json:"order_unit"`
	SeasonEndDate   string  `json:"season_end_date"`
	SafetyStockDays int     `json:"safety_stock_days"`
	BufferRatio     float64 `json:"buffer_ratio"`
	IsActive        int     `json:"is_active"`
}

// ─── GET /api/forecast ────────────────────────────────────────────────────────
// 최신 예측 스냅샷 목록 조회 (필터 지원)

func GetForecast(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)

	// 필터 파라미터
	alertFilter := c.QueryParam("alert_level")          // normal|caution|danger
	statusFilter := c.QueryParam("recommendation_status") // urgent_order|order_recommended|...
	orderOnly := c.QueryParam("order_only")              // "true" 이면 주문필요 상품만

	rows, err := forecast.GetLatestSnapshot(user.UserID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "예측 데이터 조회 실패")
	}
	defer rows.Close()

	items := []ForecastItem{}
	for rows.Next() {
		var it ForecastItem
		err := rows.Scan(
			&it.VendorItemID, &it.ProductName, &it.OptionName,
			&it.Avg7d, &it.Avg14d, &it.Avg30d, &it.ForecastDailySales,
			&it.CurrentStock, &it.InboundStock,
			&it.LeadTimeDays, &it.LeadtimeDemand,
			&it.SeasonEndDate, &it.RemainingSeasonDays, &it.AvailableSalesDaysAfterInbound,
			&it.TargetStockDays, &it.SafetyStockQty,
			&it.RecommendedQty, &it.FinalOrderQty,
			&it.DaysUntilOut, &it.AlertLevel, &it.RecommendationStatus, &it.Reason,
			&it.SnapshotDate,
		)
		if err != nil {
			continue
		}

		// 필터 적용
		if alertFilter != "" && it.AlertLevel != alertFilter {
			continue
		}
		if statusFilter != "" && it.RecommendationStatus != statusFilter {
			continue
		}
		if orderOnly == "true" && it.FinalOrderQty == 0 {
			continue
		}

		items = append(items, it)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"code":  "SUCCESS",
		"count": len(items),
		"data":  items,
	})
}

// ─── GET /api/forecast/:vendorItemId ─────────────────────────────────────────
// 특정 SKU의 예측 상세 + 최근 7일 일별 판매량

func GetForecastDetail(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)
	vendorItemID, err := strconv.ParseInt(c.Param("vendorItemId"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "유효하지 않은 vendor_item_id")
	}

	// 최신 스냅샷
	var it ForecastItem
	err = database.DB.QueryRow(`
		SELECT
			vendor_item_id, product_name, option_name,
			avg_7d, avg_14d, avg_30d, forecast_daily_sales,
			current_stock, inbound_stock,
			lead_time_days, leadtime_demand,
			season_end_date, remaining_season_days, available_sales_days_after_inbound,
			target_stock_days, safety_stock_qty,
			recommended_qty, final_order_qty,
			days_until_out, alert_level, recommendation_status, reason,
			snapshot_date
		FROM forecast_snapshot
		WHERE user_id = ? AND vendor_item_id = ?
		ORDER BY snapshot_date DESC
		LIMIT 1
	`, user.UserID, vendorItemID).Scan(
		&it.VendorItemID, &it.ProductName, &it.OptionName,
		&it.Avg7d, &it.Avg14d, &it.Avg30d, &it.ForecastDailySales,
		&it.CurrentStock, &it.InboundStock,
		&it.LeadTimeDays, &it.LeadtimeDemand,
		&it.SeasonEndDate, &it.RemainingSeasonDays, &it.AvailableSalesDaysAfterInbound,
		&it.TargetStockDays, &it.SafetyStockQty,
		&it.RecommendedQty, &it.FinalOrderQty,
		&it.DaysUntilOut, &it.AlertLevel, &it.RecommendationStatus, &it.Reason,
		&it.SnapshotDate,
	)
	if err != nil {
		// 스냅샷 없으면 실시간 계산
		today := time.Now().In(kstLoc())
		avg7 := forecast.GetSalesAvg(user.UserID, vendorItemID, today, 7)
		avg14 := forecast.GetSalesAvg(user.UserID, vendorItemID, today, 14)
		avg30 := forecast.GetSalesAvg(user.UserID, vendorItemID, today, 30)
		inbound := forecast.GetInboundStock(user.UserID, vendorItemID, today)
		fcfg := forecast.GetForecastConfig(user.UserID, vendorItemID)

		var stock int
		var productName, optionName string
		database.DB.QueryRow(`
			SELECT i.stock_quantity,
				COALESCE(p.seller_product_name, i.product_name, ''),
				COALESCE(pi.seller_product_item_name, pi.item_name, i.item_name, '')
			FROM inventory i
			LEFT JOIN product_items pi ON pi.user_id = i.user_id AND pi.vendor_item_id = i.vendor_item_id
			LEFT JOIN products p ON p.user_id = i.user_id AND p.seller_product_id = i.seller_product_id
			WHERE i.user_id = ? AND i.vendor_item_id = ?
		`, user.UserID, vendorItemID).Scan(&stock, &productName, &optionName)

		res := forecast.Calculate(forecast.Input{
			VendorItemID: vendorItemID,
			ProductName:  productName,
			OptionName:   optionName,
			CurrentStock: stock,
			InboundStock: inbound,
			Avg7d:        avg7,
			Avg14d:       avg14,
			Avg30d:       avg30,
			Config:       fcfg,
			Today:        today,
		})

		it = ForecastItem{
			VendorItemID: res.VendorItemID, ProductName: res.ProductName, OptionName: res.OptionName,
			Avg7d: res.Avg7d, Avg14d: res.Avg14d, Avg30d: res.Avg30d,
			ForecastDailySales: res.ForecastDailySales,
			CurrentStock: res.CurrentStock, InboundStock: res.InboundStock,
			LeadTimeDays: res.LeadTimeDays, LeadtimeDemand: res.LeadtimeDemand,
			SeasonEndDate: res.SeasonEndDate, RemainingSeasonDays: res.RemainingSeasonDays,
			AvailableSalesDaysAfterInbound: res.AvailableSalesDaysAfterInbound,
			TargetStockDays: res.TargetStockDays, SafetyStockQty: res.SafetyStockQty,
			RecommendedQty: res.RecommendedQty, FinalOrderQty: res.FinalOrderQty,
			DaysUntilOut: res.DaysUntilOut, AlertLevel: res.AlertLevel,
			RecommendationStatus: res.RecommendationStatus, Reason: res.Reason,
			SnapshotDate: today.Format("2006-01-02"),
		}
	}

	// 최근 30일 일별 판매량
	type DailySale struct {
		Date string `json:"date"`
		Qty  int    `json:"qty"`
	}
	dailySales := []DailySale{}
	today := time.Now().In(kstLoc())
	fromDate := today.AddDate(0, 0, -30).Format("2006-01-02")
	dRows, dErr := database.DB.Query(`
		SELECT DATE(o.paid_at) as sale_date, SUM(oi.sales_quantity) as qty
		FROM order_items oi
		JOIN orders o ON o.order_id = oi.order_id AND o.user_id = oi.user_id
		WHERE oi.user_id = ? AND oi.vendor_item_id = ?
		  AND DATE(o.paid_at) >= ?
		GROUP BY DATE(o.paid_at)
		ORDER BY sale_date ASC
	`, user.UserID, vendorItemID, fromDate)
	if dErr == nil {
		defer dRows.Close()
		for dRows.Next() {
			var ds DailySale
			dRows.Scan(&ds.Date, &ds.Qty)
			dailySales = append(dailySales, ds)
		}
	}

	// 설정값
	var cfgRow ForecastConfigRequest
	cfgRow.VendorItemID = vendorItemID
	cfgRow.IsActive = 1
	database.DB.QueryRow(`
		SELECT lead_time_days, moq, order_unit, season_end_date, safety_stock_days, buffer_ratio, is_active
		FROM order_forecast_config
		WHERE user_id = ? AND vendor_item_id = ?
	`, user.UserID, vendorItemID).Scan(
		&cfgRow.LeadTimeDays, &cfgRow.MOQ, &cfgRow.OrderUnit,
		&cfgRow.SeasonEndDate, &cfgRow.SafetyStockDays, &cfgRow.BufferRatio, &cfgRow.IsActive,
	)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"code":        "SUCCESS",
		"forecast":    it,
		"daily_sales": dailySales,
		"config":      cfgRow,
	})
}

// ─── POST /api/forecast/config ────────────────────────────────────────────────
// SKU별 발주 설정 저장

func SaveForecastConfig(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)
	var req ForecastConfigRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "요청 파싱 오류")
	}
	if req.VendorItemID == 0 {
		return echo.NewHTTPError(http.StatusBadRequest, "vendor_item_id 필수")
	}

	// 기본값 보정
	if req.LeadTimeDays <= 0 {
		req.LeadTimeDays = forecast.DefaultLeadTimeDays
	}
	if req.MOQ <= 0 {
		req.MOQ = 1
	}
	if req.OrderUnit <= 0 {
		req.OrderUnit = 1
	}
	if req.SafetyStockDays <= 0 {
		req.SafetyStockDays = forecast.DefaultSafetyStockDays
	}
	if req.BufferRatio <= 0 {
		req.BufferRatio = forecast.DefaultBufferRatio
	}
	isActive := 1
	if req.IsActive == 0 {
		isActive = 0
	}

	now := time.Now().UTC().Format("2006-01-02T15:04:05Z")
	_, err := database.DB.Exec(`
		INSERT INTO order_forecast_config
			(user_id, vendor_item_id, lead_time_days, moq, order_unit,
			 season_end_date, safety_stock_days, buffer_ratio, is_active, created_at, updated_at)
		VALUES (?,?,?,?,?,?,?,?,?,?,?)
		ON CONFLICT(user_id, vendor_item_id) DO UPDATE SET
			lead_time_days    = excluded.lead_time_days,
			moq               = excluded.moq,
			order_unit        = excluded.order_unit,
			season_end_date   = excluded.season_end_date,
			safety_stock_days = excluded.safety_stock_days,
			buffer_ratio      = excluded.buffer_ratio,
			is_active         = excluded.is_active,
			updated_at        = excluded.updated_at
	`, user.UserID, req.VendorItemID, req.LeadTimeDays, req.MOQ, req.OrderUnit,
		req.SeasonEndDate, req.SafetyStockDays, req.BufferRatio, isActive, now, now)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "설정 저장 실패")
	}

	return c.JSON(http.StatusOK, map[string]string{
		"code":    "SUCCESS",
		"message": "발주 설정이 저장되었습니다",
	})
}

// ─── GET /api/forecast/config ─────────────────────────────────────────────────
// 설정 목록 조회

func GetForecastConfigs(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)

	rows, err := database.DB.Query(`
		SELECT
			fc.vendor_item_id,
			COALESCE(pi.seller_product_item_name, pi.item_name, i.item_name, '') AS option_name,
			COALESCE(p.seller_product_name, i.product_name, '') AS product_name,
			fc.lead_time_days, fc.moq, fc.order_unit,
			fc.season_end_date, fc.safety_stock_days, fc.buffer_ratio, fc.is_active,
			fc.updated_at
		FROM order_forecast_config fc
		LEFT JOIN inventory i ON i.user_id = fc.user_id AND i.vendor_item_id = fc.vendor_item_id
		LEFT JOIN product_items pi ON pi.user_id = fc.user_id AND pi.vendor_item_id = fc.vendor_item_id
		LEFT JOIN products p ON p.user_id = fc.user_id AND p.seller_product_id = i.seller_product_id
		WHERE fc.user_id = ?
		ORDER BY fc.updated_at DESC
	`, user.UserID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "설정 조회 실패")
	}
	defer rows.Close()

	type ConfigRow struct {
		VendorItemID    int64   `json:"vendor_item_id"`
		OptionName      string  `json:"option_name"`
		ProductName     string  `json:"product_name"`
		LeadTimeDays    int     `json:"lead_time_days"`
		MOQ             int     `json:"moq"`
		OrderUnit       int     `json:"order_unit"`
		SeasonEndDate   string  `json:"season_end_date"`
		SafetyStockDays int     `json:"safety_stock_days"`
		BufferRatio     float64 `json:"buffer_ratio"`
		IsActive        int     `json:"is_active"`
		UpdatedAt       string  `json:"updated_at"`
	}

	configs := []ConfigRow{}
	for rows.Next() {
		var cr ConfigRow
		rows.Scan(
			&cr.VendorItemID, &cr.OptionName, &cr.ProductName,
			&cr.LeadTimeDays, &cr.MOQ, &cr.OrderUnit,
			&cr.SeasonEndDate, &cr.SafetyStockDays, &cr.BufferRatio, &cr.IsActive,
			&cr.UpdatedAt,
		)
		configs = append(configs, cr)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"code":  "SUCCESS",
		"count": len(configs),
		"data":  configs,
	})
}

// ─── POST /api/forecast/run ───────────────────────────────────────────────────
// 예측 배치 수동 실행

func RunForecast(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)
	today := time.Now().In(kstLoc())

	count, err := forecast.RunForUser(user.UserID, today)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "예측 실행 실패: "+err.Error())
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"code":          "SUCCESS",
		"message":       "예측 스냅샷 생성 완료",
		"snapshot_date": today.Format("2006-01-02"),
		"count":         count,
	})
}

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────────

func kstLoc() *time.Location {
	loc, _ := time.LoadLocation("Asia/Seoul")
	if loc == nil {
		loc = time.FixedZone("KST", 9*60*60)
	}
	return loc
}
