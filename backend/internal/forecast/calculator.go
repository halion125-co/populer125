package forecast

import (
	"database/sql"
	"fmt"
	"math"
	"time"

	"github.com/rocketgrowth/backend/internal/database"
)

const (
	AlertNormal  = "normal"
	AlertCaution = "caution"
	AlertDanger  = "danger"

	StatusNormal         = "normal"
	StatusUrgentOrder    = "urgent_order"
	StatusOrderRecommended = "order_recommended"
	StatusHold           = "hold"
	StatusNoOrder        = "no_order"
	StatusSeasonBlocked  = "season_blocked"
	StatusOverstock      = "overstock"

	DefaultTargetStockDays  = 21
	DefaultLeadTimeDays     = 14
	DefaultSafetyStockDays  = 3
	DefaultBufferRatio      = 0.15
)

// Config는 SKU별 발주 예측 설정을 담는다
type Config struct {
	LeadTimeDays    int
	MOQ             int
	OrderUnit       int
	SeasonEndDate   string // "2026-07-05" 형식, 없으면 빈 문자열
	SafetyStockDays int
	BufferRatio     float64
}

// Input은 계산에 필요한 입력값을 담는다
type Input struct {
	VendorItemID int64
	ProductName  string
	OptionName   string
	CurrentStock int
	InboundStock int
	Avg7d        float64
	Avg14d       float64
	Avg30d       float64
	Config       Config
	Today        time.Time
}

// Result는 계산 결과를 담는다
type Result struct {
	VendorItemID                    int64
	ProductName                     string
	OptionName                      string
	Avg7d                           float64
	Avg14d                          float64
	Avg30d                          float64
	ForecastDailySales              float64
	CurrentStock                    int
	InboundStock                    int
	LeadTimeDays                    int
	LeadtimeDemand                  float64
	SeasonEndDate                   string
	RemainingSeasonDays             int
	AvailableSalesDaysAfterInbound  int
	TargetStockDays                 int
	SafetyStockQty                  float64
	RecommendedQty                  int
	FinalOrderQty                   int
	DaysUntilOut                    float64
	AlertLevel                      string
	RecommendationStatus            string
	Reason                          string
}

// Calculate는 요청서 로직을 그대로 구현한 예측 계산 함수
func Calculate(in Input) Result {
	r := Result{
		VendorItemID: in.VendorItemID,
		ProductName:  in.ProductName,
		OptionName:   in.OptionName,
		Avg7d:        in.Avg7d,
		Avg14d:       in.Avg14d,
		Avg30d:       in.Avg30d,
		CurrentStock: in.CurrentStock,
		InboundStock: in.InboundStock,
		LeadTimeDays: in.Config.LeadTimeDays,
	}

	// 4.2 예측 일판매량 (가중 평균)
	r.ForecastDailySales = in.Avg7d*0.5 + in.Avg14d*0.3 + in.Avg30d*0.2

	// 4.3 리드타임 수요
	r.LeadtimeDemand = r.ForecastDailySales * float64(in.Config.LeadTimeDays)

	// 4.4 재고 소진 예상일
	if r.ForecastDailySales > 0 {
		r.DaysUntilOut = float64(in.CurrentStock) / r.ForecastDailySales
	} else {
		r.DaysUntilOut = 999
	}

	// 4.6 시즌 종료 처리
	r.SeasonEndDate = in.Config.SeasonEndDate
	hasSeasonEnd := in.Config.SeasonEndDate != ""
	if hasSeasonEnd {
		seEnd, err := time.Parse("2006-01-02", in.Config.SeasonEndDate)
		if err == nil {
			r.RemainingSeasonDays = int(math.Ceil(seEnd.Sub(in.Today).Hours() / 24))
			expectedInboundDate := in.Today.AddDate(0, 0, in.Config.LeadTimeDays)
			r.AvailableSalesDaysAfterInbound = int(math.Ceil(seEnd.Sub(expectedInboundDate).Hours() / 24))
		}
	}

	// 4.7 목표재고일수
	r.TargetStockDays = DefaultTargetStockDays
	if hasSeasonEnd && r.RemainingSeasonDays > 0 {
		effectiveDays := r.RemainingSeasonDays - in.Config.LeadTimeDays
		if effectiveDays < r.TargetStockDays {
			r.TargetStockDays = effectiveDays
		}
	}
	if r.TargetStockDays < 0 {
		r.TargetStockDays = 0
	}

	// 4.8 안전재고
	r.SafetyStockQty = r.ForecastDailySales * float64(in.Config.SafetyStockDays)

	// 4.9 추천 주문수량
	targetStockQty := r.ForecastDailySales * float64(r.TargetStockDays)
	recommended := targetStockQty + r.SafetyStockQty - float64(in.CurrentStock) - float64(in.InboundStock)
	r.RecommendedQty = int(math.Ceil(recommended))

	// 4.10 최종 주문수량
	finalQty := r.RecommendedQty
	if finalQty < 0 {
		finalQty = 0
	}
	if finalQty > 0 && finalQty < in.Config.MOQ {
		finalQty = in.Config.MOQ
	}
	if finalQty > 0 && in.Config.OrderUnit > 1 {
		finalQty = int(math.Ceil(float64(finalQty)/float64(in.Config.OrderUnit))) * in.Config.OrderUnit
	}
	r.FinalOrderQty = finalQty

	// 5. 상태값 결정
	r.AlertLevel, r.RecommendationStatus, r.Reason = determineStatus(r, in.Config, hasSeasonEnd)

	return r
}

func determineStatus(r Result, cfg Config, hasSeasonEnd bool) (alertLevel, recStatus, reason string) {
	// 시즌 종료 차단
	if hasSeasonEnd {
		if r.AvailableSalesDaysAfterInbound <= 0 {
			return AlertNormal, StatusSeasonBlocked, "입고 후 판매 가능 기간 없음 (시즌 종료 임박)"
		}
		if r.RemainingSeasonDays <= cfg.LeadTimeDays {
			return AlertNormal, StatusHold, "시즌 종료까지 리드타임 이내 — 주문 금지"
		}
	}

	// 과재고
	if r.FinalOrderQty == 0 && r.RecommendedQty < 0 {
		surplus := -r.RecommendedQty
		return AlertNormal, StatusOverstock, reasonf("현재 재고 과다 (약 %d개 초과)", surplus)
	}

	// alert_level
	if r.DaysUntilOut <= float64(cfg.LeadTimeDays) {
		alertLevel = AlertDanger
	} else if r.DaysUntilOut <= float64(cfg.LeadTimeDays+7) {
		alertLevel = AlertCaution
	} else {
		alertLevel = AlertNormal
	}

	// recommendation_status
	if r.FinalOrderQty == 0 {
		return alertLevel, StatusNoOrder, "주문 불필요"
	}
	if r.DaysUntilOut <= float64(cfg.LeadTimeDays) {
		return alertLevel, StatusUrgentOrder, reasonf("%.0f일 후 품절 예상 (리드타임 %d일 이내)", r.DaysUntilOut, cfg.LeadTimeDays)
	}
	return alertLevel, StatusOrderRecommended, reasonf("%.0f일 후 소진 예상, %d개 발주 권장", r.DaysUntilOut, r.FinalOrderQty)
}

func reasonf(format string, args ...any) string {
	return fmt.Sprintf(format, args...)
}

// ─── DB 연동 함수 ─────────────────────────────────────────────────────────────

// GetSalesAvg는 특정 SKU의 N일 판매 평균을 계산한다 (판매 없는 날 포함해 나눔)
func GetSalesAvg(userID, vendorItemID int64, today time.Time, days int) float64 {
	fromDate := today.AddDate(0, 0, -days).Format("2006-01-02")
	toDate := today.Format("2006-01-02")
	var total float64
	err := database.DB.QueryRow(`
		SELECT COALESCE(SUM(oi.sales_quantity), 0)
		FROM order_items oi
		JOIN orders o ON o.order_id = oi.order_id AND o.user_id = oi.user_id
		WHERE oi.user_id = ?
		  AND oi.vendor_item_id = ?
		  AND DATE(o.paid_at) >= ?
		  AND DATE(o.paid_at) <= ?
	`, userID, vendorItemID, fromDate, toDate).Scan(&total)
	if err != nil {
		return 0
	}
	return math.Round(total/float64(days)*10) / 10
}

// GetInboundStock은 입고 예정 수량 합계를 반환한다
func GetInboundStock(userID, vendorItemID int64, today time.Time) int {
	todayStr := today.Format("2006-01-02")
	var total int
	database.DB.QueryRow(`
		SELECT COALESCE(SUM(planned_qty - arrived_qty), 0)
		FROM inbound_plan
		WHERE user_id = ?
		  AND vendor_item_id = ?
		  AND status = 'pending'
		  AND expected_at >= ?
	`, userID, vendorItemID, todayStr).Scan(&total)
	if total < 0 {
		total = 0
	}
	return total
}

// GetForecastConfig는 SKU별 설정을 조회한다 (없으면 기본값 반환)
func GetForecastConfig(userID, vendorItemID int64) Config {
	cfg := Config{
		LeadTimeDays:    DefaultLeadTimeDays,
		MOQ:             1,
		OrderUnit:       1,
		SafetyStockDays: DefaultSafetyStockDays,
		BufferRatio:     DefaultBufferRatio,
	}
	var leadTime, moq, orderUnit, safetyDays int
	var bufferRatio float64
	var seasonEndDate string
	err := database.DB.QueryRow(`
		SELECT lead_time_days, moq, order_unit, season_end_date, safety_stock_days, buffer_ratio
		FROM order_forecast_config
		WHERE user_id = ? AND vendor_item_id = ? AND is_active = 1
	`, userID, vendorItemID).Scan(&leadTime, &moq, &orderUnit, &seasonEndDate, &safetyDays, &bufferRatio)
	if err == nil {
		cfg.LeadTimeDays = leadTime
		cfg.MOQ = moq
		cfg.OrderUnit = orderUnit
		cfg.SeasonEndDate = seasonEndDate
		cfg.SafetyStockDays = safetyDays
		cfg.BufferRatio = bufferRatio
	}
	return cfg
}

// RunForUser는 특정 유저의 모든 활성 SKU에 대해 예측을 계산하고 스냅샷을 저장한다
func RunForUser(userID int64, today time.Time) (int, error) {
	todayStr := today.Format("2006-01-02")

	// 판매중 SKU 목록 조회 (inventory 기준, product_items JOIN으로 이름 가져옴)
	rows, err := database.DB.Query(`
		SELECT
			i.vendor_item_id,
			COALESCE(p.seller_product_name, i.product_name, '') AS product_name,
			COALESCE(pi.seller_product_item_name, pi.item_name, i.item_name, '') AS option_name,
			i.stock_quantity
		FROM inventory i
		LEFT JOIN product_items pi ON pi.user_id = i.user_id AND pi.vendor_item_id = i.vendor_item_id
		LEFT JOIN products p ON p.user_id = i.user_id AND p.seller_product_id = i.seller_product_id
		WHERE i.user_id = ?
		  AND i.stock_quantity >= 0
	`, userID)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	type skuRow struct {
		VendorItemID int64
		ProductName  string
		OptionName   string
		Stock        int
	}
	var skus []skuRow
	for rows.Next() {
		var s skuRow
		rows.Scan(&s.VendorItemID, &s.ProductName, &s.OptionName, &s.Stock)
		skus = append(skus, s)
	}
	rows.Close()

	count := 0
	for _, sku := range skus {
		avg7 := GetSalesAvg(userID, sku.VendorItemID, today, 7)
		avg14 := GetSalesAvg(userID, sku.VendorItemID, today, 14)
		avg30 := GetSalesAvg(userID, sku.VendorItemID, today, 30)

		// 판매 이력이 없고 재고도 없으면 스킵
		if avg7 == 0 && avg14 == 0 && avg30 == 0 && sku.Stock == 0 {
			continue
		}

		inbound := GetInboundStock(userID, sku.VendorItemID, today)
		fcfg := GetForecastConfig(userID, sku.VendorItemID)

		in := Input{
			VendorItemID: sku.VendorItemID,
			ProductName:  sku.ProductName,
			OptionName:   sku.OptionName,
			CurrentStock: sku.Stock,
			InboundStock: inbound,
			Avg7d:        avg7,
			Avg14d:       avg14,
			Avg30d:       avg30,
			Config:       fcfg,
			Today:        today,
		}
		res := Calculate(in)

		_, err := database.DB.Exec(`
			INSERT INTO forecast_snapshot (
				user_id, vendor_item_id, snapshot_date,
				product_name, option_name,
				avg_7d, avg_14d, avg_30d, forecast_daily_sales,
				current_stock, inbound_stock,
				lead_time_days, leadtime_demand,
				season_end_date, remaining_season_days, available_sales_days_after_inbound,
				target_stock_days, safety_stock_qty,
				recommended_qty, final_order_qty,
				days_until_out, alert_level, recommendation_status, reason
			) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
			ON CONFLICT(user_id, vendor_item_id, snapshot_date) DO UPDATE SET
				product_name = excluded.product_name,
				option_name = excluded.option_name,
				avg_7d = excluded.avg_7d,
				avg_14d = excluded.avg_14d,
				avg_30d = excluded.avg_30d,
				forecast_daily_sales = excluded.forecast_daily_sales,
				current_stock = excluded.current_stock,
				inbound_stock = excluded.inbound_stock,
				lead_time_days = excluded.lead_time_days,
				leadtime_demand = excluded.leadtime_demand,
				season_end_date = excluded.season_end_date,
				remaining_season_days = excluded.remaining_season_days,
				available_sales_days_after_inbound = excluded.available_sales_days_after_inbound,
				target_stock_days = excluded.target_stock_days,
				safety_stock_qty = excluded.safety_stock_qty,
				recommended_qty = excluded.recommended_qty,
				final_order_qty = excluded.final_order_qty,
				days_until_out = excluded.days_until_out,
				alert_level = excluded.alert_level,
				recommendation_status = excluded.recommendation_status,
				reason = excluded.reason,
				created_at = CURRENT_TIMESTAMP
		`,
			userID, res.VendorItemID, todayStr,
			res.ProductName, res.OptionName,
			res.Avg7d, res.Avg14d, res.Avg30d, res.ForecastDailySales,
			res.CurrentStock, res.InboundStock,
			res.LeadTimeDays, res.LeadtimeDemand,
			res.SeasonEndDate, res.RemainingSeasonDays, res.AvailableSalesDaysAfterInbound,
			res.TargetStockDays, res.SafetyStockQty,
			res.RecommendedQty, res.FinalOrderQty,
			res.DaysUntilOut, res.AlertLevel, res.RecommendationStatus, res.Reason,
		)
		if err == nil {
			count++
		}
	}

	return count, nil
}

// GetLatestSnapshot은 유저의 최신 스냅샷 목록을 반환한다
func GetLatestSnapshot(userID int64) (*sql.Rows, error) {
	return database.DB.Query(`
		SELECT
			fs.vendor_item_id,
			fs.product_name,
			fs.option_name,
			fs.avg_7d,
			fs.avg_14d,
			fs.avg_30d,
			fs.forecast_daily_sales,
			fs.current_stock,
			fs.inbound_stock,
			fs.lead_time_days,
			fs.leadtime_demand,
			fs.season_end_date,
			fs.remaining_season_days,
			fs.available_sales_days_after_inbound,
			fs.target_stock_days,
			fs.safety_stock_qty,
			fs.recommended_qty,
			fs.final_order_qty,
			fs.days_until_out,
			fs.alert_level,
			fs.recommendation_status,
			fs.reason,
			fs.snapshot_date
		FROM forecast_snapshot fs
		INNER JOIN (
			SELECT vendor_item_id, MAX(snapshot_date) AS latest
			FROM forecast_snapshot
			WHERE user_id = ?
			GROUP BY vendor_item_id
		) latest ON latest.vendor_item_id = fs.vendor_item_id AND latest.latest = fs.snapshot_date
		WHERE fs.user_id = ?
		ORDER BY fs.alert_level DESC, fs.days_until_out ASC
	`, userID, userID)
}
