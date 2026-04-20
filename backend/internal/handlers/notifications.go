package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/rocketgrowth/backend/internal/database"
)

// RegisterDeviceToken upserts an FCM token for the authenticated user.
func RegisterDeviceToken(c echo.Context) error {
	userID := c.Get("user_id").(int64)

	var req struct {
		FCMToken   string `json:"fcm_token"`
		Platform   string `json:"platform"`
		DeviceName string `json:"device_name"`
	}
	if err := c.Bind(&req); err != nil || req.FCMToken == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "fcm_token is required")
	}

	var existingTokenID int64
	err := database.DB.QueryRow("SELECT id FROM device_tokens WHERE user_id = ? AND fcm_token = ?", userID, req.FCMToken).Scan(&existingTokenID)
	if err == sql.ErrNoRows {
		_, err = database.DB.Exec(
			"INSERT INTO device_tokens (user_id, fcm_token, platform, device_name, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)",
			userID, req.FCMToken, req.Platform, req.DeviceName,
		)
	} else if err == nil {
		_, err = database.DB.Exec(
			"UPDATE device_tokens SET platform=?, device_name=?, updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND fcm_token=?",
			req.Platform, req.DeviceName, userID, req.FCMToken,
		)
	}
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("저장 실패: %v", err))
	}

	return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
}

// RemoveDeviceToken deletes an FCM token on logout.
func RemoveDeviceToken(c echo.Context) error {
	userID := c.Get("user_id").(int64)

	var req struct {
		FCMToken string `json:"fcm_token"`
	}
	if err := c.Bind(&req); err != nil || req.FCMToken == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "fcm_token is required")
	}

	database.DB.Exec("DELETE FROM device_tokens WHERE user_id = ? AND fcm_token = ?", userID, req.FCMToken)
	return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
}

// GetNotificationHistory returns paginated push notification history.
func GetNotificationHistory(c echo.Context) error {
	userID := c.Get("user_id").(int64)

	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	var total int
	database.DB.QueryRow("SELECT COUNT(*) FROM push_notification_history WHERE user_id = ?", userID).Scan(&total)

	rows, err := database.DB.Query(`
		SELECT id, title, total_qty, total_amount, detail_json, sent_at
		FROM push_notification_history
		WHERE user_id = ?
		ORDER BY sent_at DESC
		LIMIT ? OFFSET ?
	`, userID, limit, offset)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "조회 실패")
	}
	defer rows.Close()

	type Item struct {
		ID          int64     `json:"id"`
		Title       string    `json:"title"`
		TotalQty    int       `json:"total_qty"`
		TotalAmount float64   `json:"total_amount"`
		DetailJSON  []string  `json:"detail_json"`
		SentAt      time.Time `json:"sent_at"`
	}

	items := []Item{}
	for rows.Next() {
		var it Item
		var detailRaw string
		var sentAt string
		if err := rows.Scan(&it.ID, &it.Title, &it.TotalQty, &it.TotalAmount, &detailRaw, &sentAt); err != nil {
			continue
		}
		json.Unmarshal([]byte(detailRaw), &it.DetailJSON)
		it.SentAt, _ = time.Parse("2006-01-02 15:04:05", sentAt)
		items = append(items, it)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"items": items,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// GetNotificationSettings returns notification settings for the user.
func GetNotificationSettings(c echo.Context) error {
	userID := c.Get("user_id").(int64)

	var pushEnabled int
	var quietStart, quietEnd string
	err := database.DB.QueryRow(
		"SELECT push_enabled, quiet_start, quiet_end FROM notification_settings WHERE user_id = ?",
		userID,
	).Scan(&pushEnabled, &quietStart, &quietEnd)

	if err == sql.ErrNoRows {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"push_enabled": true,
			"quiet_start":  "",
			"quiet_end":    "",
		})
	}
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "조회 실패")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"push_enabled": pushEnabled == 1,
		"quiet_start":  quietStart,
		"quiet_end":    quietEnd,
	})
}

// UpdateNotificationSettings saves notification settings.
func UpdateNotificationSettings(c echo.Context) error {
	userID := c.Get("user_id").(int64)

	var req struct {
		PushEnabled bool   `json:"push_enabled"`
		QuietStart  string `json:"quiet_start"`
		QuietEnd    string `json:"quiet_end"`
	}
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request")
	}

	pushEnabledInt := 0
	if req.PushEnabled {
		pushEnabledInt = 1
	}

	// SELECT 후 INSERT or UPDATE (SQLite UPSERT 버전 호환성 확보)
	var existingID int64
	err := database.DB.QueryRow("SELECT id FROM notification_settings WHERE user_id = ?", userID).Scan(&existingID)
	if err == sql.ErrNoRows {
		_, err = database.DB.Exec(
			"INSERT INTO notification_settings (user_id, push_enabled, quiet_start, quiet_end, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)",
			userID, pushEnabledInt, req.QuietStart, req.QuietEnd,
		)
	} else if err == nil {
		_, err = database.DB.Exec(
			"UPDATE notification_settings SET push_enabled=?, quiet_start=?, quiet_end=?, updated_at=CURRENT_TIMESTAMP WHERE user_id=?",
			pushEnabledInt, req.QuietStart, req.QuietEnd, userID,
		)
	}
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("저장 실패: %v", err))
	}

	return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
}
