package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/rocketgrowth/backend/internal/database"
	"github.com/rocketgrowth/backend/internal/middleware"
)

type InboundPlanRequest struct {
	VendorItemID int64  `json:"vendor_item_id"`
	PlannedQty   int    `json:"planned_qty"`
	ExpectedAt   string `json:"expected_at"` // "2026-06-01"
	Memo         string `json:"memo"`
}

type InboundPlanUpdateRequest struct {
	PlannedQty int    `json:"planned_qty"`
	ExpectedAt string `json:"expected_at"`
	Status     string `json:"status"`      // pending|arrived
	ArrivedQty int    `json:"arrived_qty"`
	Memo       string `json:"memo"`
}

type InboundPlanRow struct {
	ID           int64  `json:"id"`
	VendorItemID int64  `json:"vendor_item_id"`
	ProductName  string `json:"product_name"`
	OptionName   string `json:"option_name"`
	PlannedQty   int    `json:"planned_qty"`
	ExpectedAt   string `json:"expected_at"`
	Status       string `json:"status"`
	ArrivedQty   int    `json:"arrived_qty"`
	Memo         string `json:"memo"`
	CreatedAt    string `json:"created_at"`
	UpdatedAt    string `json:"updated_at"`
}

// ─── GET /api/inbound-plan ────────────────────────────────────────────────────

func GetInboundPlans(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)
	statusFilter := c.QueryParam("status") // pending|arrived|all

	query := `
		SELECT
			ip.id, ip.vendor_item_id,
			COALESCE(p.seller_product_name, i.product_name, '') AS product_name,
			COALESCE(pi.seller_product_item_name, pi.item_name, i.item_name, '') AS option_name,
			ip.planned_qty, ip.expected_at, ip.status, ip.arrived_qty,
			COALESCE(ip.memo, ''), ip.created_at, ip.updated_at
		FROM inbound_plan ip
		LEFT JOIN inventory i ON i.user_id = ip.user_id AND i.vendor_item_id = ip.vendor_item_id
		LEFT JOIN product_items pi ON pi.user_id = ip.user_id AND pi.vendor_item_id = ip.vendor_item_id
		LEFT JOIN products p ON p.user_id = ip.user_id AND p.seller_product_id = i.seller_product_id
		WHERE ip.user_id = ?`

	args := []interface{}{user.UserID}
	if statusFilter != "" && statusFilter != "all" {
		query += " AND ip.status = ?"
		args = append(args, statusFilter)
	}
	query += " ORDER BY ip.expected_at ASC, ip.created_at DESC"

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "입고 예정 조회 실패")
	}
	defer rows.Close()

	plans := []InboundPlanRow{}
	for rows.Next() {
		var p InboundPlanRow
		rows.Scan(
			&p.ID, &p.VendorItemID, &p.ProductName, &p.OptionName,
			&p.PlannedQty, &p.ExpectedAt, &p.Status, &p.ArrivedQty,
			&p.Memo, &p.CreatedAt, &p.UpdatedAt,
		)
		plans = append(plans, p)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"code":  "SUCCESS",
		"count": len(plans),
		"data":  plans,
	})
}

// ─── POST /api/inbound-plan ───────────────────────────────────────────────────

func CreateInboundPlan(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)
	var req InboundPlanRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "요청 파싱 오류")
	}
	if req.VendorItemID == 0 {
		return echo.NewHTTPError(http.StatusBadRequest, "vendor_item_id 필수")
	}
	if req.PlannedQty <= 0 {
		return echo.NewHTTPError(http.StatusBadRequest, "planned_qty는 1 이상이어야 합니다")
	}
	if req.ExpectedAt == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "expected_at 필수 (YYYY-MM-DD)")
	}
	if _, err := time.Parse("2006-01-02", req.ExpectedAt); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "expected_at 형식 오류 (YYYY-MM-DD)")
	}

	now := time.Now().UTC().Format("2006-01-02T15:04:05Z")
	result, err := database.DB.Exec(`
		INSERT INTO inbound_plan (user_id, vendor_item_id, planned_qty, expected_at, memo, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, user.UserID, req.VendorItemID, req.PlannedQty, req.ExpectedAt, req.Memo, now, now)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "입고 예정 등록 실패")
	}

	id, _ := result.LastInsertId()
	return c.JSON(http.StatusCreated, map[string]interface{}{
		"code":    "SUCCESS",
		"message": "입고 예정이 등록되었습니다",
		"id":      id,
	})
}

// ─── PUT /api/inbound-plan/:id ────────────────────────────────────────────────

func UpdateInboundPlan(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)
	planID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "유효하지 않은 id")
	}

	// 소유권 확인
	var ownerID int64
	if err := database.DB.QueryRow("SELECT user_id FROM inbound_plan WHERE id = ?", planID).Scan(&ownerID); err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "입고 예정을 찾을 수 없습니다")
	}
	if ownerID != user.UserID {
		return echo.NewHTTPError(http.StatusForbidden, "권한 없음")
	}

	var req InboundPlanUpdateRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "요청 파싱 오류")
	}
	if req.ExpectedAt != "" {
		if _, err := time.Parse("2006-01-02", req.ExpectedAt); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "expected_at 형식 오류 (YYYY-MM-DD)")
		}
	}
	if req.Status != "" && req.Status != "pending" && req.Status != "arrived" {
		return echo.NewHTTPError(http.StatusBadRequest, "status는 pending 또는 arrived")
	}

	now := time.Now().UTC().Format("2006-01-02T15:04:05Z")
	_, err = database.DB.Exec(`
		UPDATE inbound_plan SET
			planned_qty = CASE WHEN ? > 0 THEN ? ELSE planned_qty END,
			expected_at = CASE WHEN ? != '' THEN ? ELSE expected_at END,
			status      = CASE WHEN ? != '' THEN ? ELSE status END,
			arrived_qty = CASE WHEN ? > 0 THEN ? ELSE arrived_qty END,
			memo        = ?,
			updated_at  = ?
		WHERE id = ?
	`,
		req.PlannedQty, req.PlannedQty,
		req.ExpectedAt, req.ExpectedAt,
		req.Status, req.Status,
		req.ArrivedQty, req.ArrivedQty,
		req.Memo,
		now,
		planID,
	)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "입고 예정 수정 실패")
	}

	return c.JSON(http.StatusOK, map[string]string{
		"code":    "SUCCESS",
		"message": "입고 예정이 수정되었습니다",
	})
}

// ─── DELETE /api/inbound-plan/:id ────────────────────────────────────────────

func DeleteInboundPlan(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)
	planID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "유효하지 않은 id")
	}

	var ownerID int64
	if err := database.DB.QueryRow("SELECT user_id FROM inbound_plan WHERE id = ?", planID).Scan(&ownerID); err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "입고 예정을 찾을 수 없습니다")
	}
	if ownerID != user.UserID {
		return echo.NewHTTPError(http.StatusForbidden, "권한 없음")
	}

	database.DB.Exec("DELETE FROM inbound_plan WHERE id = ?", planID)
	return c.JSON(http.StatusOK, map[string]string{
		"code":    "SUCCESS",
		"message": "삭제되었습니다",
	})
}
