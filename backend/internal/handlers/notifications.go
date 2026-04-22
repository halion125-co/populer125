package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/rocketgrowth/backend/internal/config"
	"github.com/rocketgrowth/backend/internal/database"
	"github.com/rocketgrowth/backend/internal/middleware"
)

// RegisterDeviceToken upserts an FCM token for the authenticated user.
func RegisterDeviceToken(c echo.Context) error {
	userID := c.Get("user").(*middleware.UserContext).UserID

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
	userID := c.Get("user").(*middleware.UserContext).UserID

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
	userID := c.Get("user").(*middleware.UserContext).UserID

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

// GetFCMMonitor returns all users' FCM token status and push history for admin monitoring.
func GetFCMMonitor(cfg *config.Config) echo.HandlerFunc {
	return func(c echo.Context) error {
		user := c.Get("user").(*middleware.UserContext)
		if cfg.AdminEmail == "" || user.Email != cfg.AdminEmail {
			return echo.NewHTTPError(http.StatusForbidden, "관리자 권한이 필요합니다")
		}
		return getFCMMonitorHandler(c)
	}
}

func getFCMMonitorHandler(c echo.Context) error {
	// Per-user token + settings summary
	type UserRow struct {
		UserID     int64  `json:"user_id"`
		Email      string `json:"email"`
		TokenCount int    `json:"token_count"`
		Platforms  string `json:"platforms"`
		LastSeen   string `json:"last_seen"`
		PushEnabled int   `json:"push_enabled"`
		QuietStart string  `json:"quiet_start"`
		QuietEnd   string  `json:"quiet_end"`
	}

	userRows, err := database.DB.Query(`
		SELECT u.id, u.email,
		       COUNT(dt.id) AS token_count,
		       GROUP_CONCAT(DISTINCT dt.platform) AS platforms,
		       MAX(dt.updated_at) AS last_seen
		FROM users u
		LEFT JOIN device_tokens dt ON dt.user_id = u.id
		GROUP BY u.id, u.email
		ORDER BY u.id
	`)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "조회 실패")
	}
	defer userRows.Close()

	users := []UserRow{}
	for userRows.Next() {
		var ur UserRow
		var platforms, lastSeen sql.NullString
		if err := userRows.Scan(&ur.UserID, &ur.Email, &ur.TokenCount, &platforms, &lastSeen); err != nil {
			continue
		}
		ur.Platforms = platforms.String
		ur.LastSeen = lastSeen.String

		// load notification settings
		var pushEnabled sql.NullInt64
		var quietStart, quietEnd sql.NullString
		database.DB.QueryRow(
			"SELECT push_enabled, quiet_start, quiet_end FROM notification_settings WHERE user_id = ?",
			ur.UserID,
		).Scan(&pushEnabled, &quietStart, &quietEnd)
		if pushEnabled.Valid {
			ur.PushEnabled = int(pushEnabled.Int64)
		} else {
			ur.PushEnabled = 1 // default
		}
		ur.QuietStart = quietStart.String
		ur.QuietEnd = quietEnd.String
		users = append(users, ur)
	}

	// Recent push history (last 100)
	type HistoryRow struct {
		ID          int64   `json:"id"`
		UserID      int64   `json:"user_id"`
		Email       string  `json:"email"`
		Title       string  `json:"title"`
		TotalQty    int     `json:"total_qty"`
		TotalAmount float64 `json:"total_amount"`
		DetailJSON  string  `json:"detail_json"`
		SentAt      string  `json:"sent_at"`
	}

	histRows, err := database.DB.Query(`
		SELECT h.id, h.user_id, u.email, h.title, h.total_qty, h.total_amount, h.detail_json, h.sent_at
		FROM push_notification_history h
		JOIN users u ON u.id = h.user_id
		ORDER BY h.sent_at DESC
		LIMIT 100
	`)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "히스토리 조회 실패")
	}
	defer histRows.Close()

	history := []HistoryRow{}
	for histRows.Next() {
		var hr HistoryRow
		if err := histRows.Scan(&hr.ID, &hr.UserID, &hr.Email, &hr.Title, &hr.TotalQty, &hr.TotalAmount, &hr.DetailJSON, &hr.SentAt); err != nil {
			continue
		}
		history = append(history, hr)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"users":   users,
		"history": history,
	})
}

// GetFCMDebugStatus returns FCM token and notification settings for debugging.
func GetFCMDebugStatus(c echo.Context) error {
	userID := c.Get("user").(*middleware.UserContext).UserID

	type TokenRow struct {
		ID         int64  `json:"id"`
		FCMToken   string `json:"fcm_token"`
		Platform   string `json:"platform"`
		DeviceName string `json:"device_name"`
		UpdatedAt  string `json:"updated_at"`
	}

	rows, err := database.DB.Query(
		"SELECT id, fcm_token, platform, device_name, updated_at FROM device_tokens WHERE user_id = ? ORDER BY updated_at DESC",
		userID,
	)
	tokens := []TokenRow{}
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var t TokenRow
			if rows.Scan(&t.ID, &t.FCMToken, &t.Platform, &t.DeviceName, &t.UpdatedAt) == nil {
				tokens = append(tokens, t)
			}
		}
	}

	var pushEnabled int
	var quietStart, quietEnd string
	settingsErr := database.DB.QueryRow(
		"SELECT push_enabled, quiet_start, quiet_end FROM notification_settings WHERE user_id = ?",
		userID,
	).Scan(&pushEnabled, &quietStart, &quietEnd)

	settings := map[string]interface{}{
		"found":        settingsErr == nil,
		"push_enabled": pushEnabled == 1,
		"quiet_start":  quietStart,
		"quiet_end":    quietEnd,
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"user_id":       userID,
		"device_tokens": tokens,
		"token_count":   len(tokens),
		"settings":      settings,
	})
}

// GetNotificationSettings returns notification settings for the user.
func GetNotificationSettings(c echo.Context) error {
	userID := c.Get("user").(*middleware.UserContext).UserID

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
	userID := c.Get("user").(*middleware.UserContext).UserID

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
