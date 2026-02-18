package handlers

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/rocketgrowth/backend/internal/database"
	"github.com/rocketgrowth/backend/internal/middleware"
	"github.com/rocketgrowth/backend/internal/models"
	"golang.org/x/crypto/bcrypt"
)

// GetProfile returns the authenticated user's profile
func GetProfile(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)

	var profile models.UserProfile
	err := database.DB.QueryRow(
		"SELECT id, email, phone, vendor_id, access_key, secret_key, created_at FROM users WHERE id = ?",
		user.UserID,
	).Scan(&profile.ID, &profile.Email, &profile.Phone, &profile.VendorID, &profile.AccessKey, &profile.HasSecret, &profile.CreatedAt)
	if err == sql.ErrNoRows {
		return echo.NewHTTPError(http.StatusNotFound, "사용자를 찾을 수 없습니다")
	}
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "서버 오류가 발생했습니다")
	}

	// HasSecret: convert non-empty string to true
	// Re-query with secret_key to check
	var secretKey string
	database.DB.QueryRow("SELECT secret_key FROM users WHERE id = ?", user.UserID).Scan(&secretKey)
	profile.HasSecret = secretKey != ""

	return c.JSON(http.StatusOK, profile)
}

// UpdateProfile updates email, phone, vendorId, accessKey, secretKey
func UpdateProfile(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)

	var req models.UpdateProfileRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request")
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "이메일은 필수입니다")
	}

	// Build update query - only update secret_key if provided
	if req.SecretKey != "" {
		_, err := database.DB.Exec(
			`UPDATE users SET email=?, phone=?, vendor_id=?, access_key=?, secret_key=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
			req.Email, strings.TrimSpace(req.Phone),
			strings.TrimSpace(req.VendorID), strings.TrimSpace(req.AccessKey),
			strings.TrimSpace(req.SecretKey), user.UserID,
		)
		if err != nil {
			if strings.Contains(err.Error(), "UNIQUE constraint failed") {
				return echo.NewHTTPError(http.StatusConflict, "이미 사용 중인 이메일입니다")
			}
			return echo.NewHTTPError(http.StatusInternalServerError, "업데이트에 실패했습니다")
		}
	} else {
		_, err := database.DB.Exec(
			`UPDATE users SET email=?, phone=?, vendor_id=?, access_key=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
			req.Email, strings.TrimSpace(req.Phone),
			strings.TrimSpace(req.VendorID), strings.TrimSpace(req.AccessKey),
			user.UserID,
		)
		if err != nil {
			if strings.Contains(err.Error(), "UNIQUE constraint failed") {
				return echo.NewHTTPError(http.StatusConflict, "이미 사용 중인 이메일입니다")
			}
			return echo.NewHTTPError(http.StatusInternalServerError, "업데이트에 실패했습니다")
		}
	}

	return GetProfile(c)
}

// ChangePassword updates the user's password
func ChangePassword(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)

	var req models.ChangePasswordRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request")
	}

	if req.CurrentPassword == "" || req.NewPassword == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "현재 비밀번호와 새 비밀번호를 입력해주세요")
	}
	if len(req.NewPassword) < 6 {
		return echo.NewHTTPError(http.StatusBadRequest, "새 비밀번호는 6자 이상이어야 합니다")
	}

	// Get current hashed password
	var hashedPW string
	err := database.DB.QueryRow("SELECT password FROM users WHERE id = ?", user.UserID).Scan(&hashedPW)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "서버 오류가 발생했습니다")
	}

	// Verify current password
	if err := bcrypt.CompareHashAndPassword([]byte(hashedPW), []byte(req.CurrentPassword)); err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "현재 비밀번호가 올바르지 않습니다")
	}

	// Hash new password
	newHashed, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "서버 오류가 발생했습니다")
	}

	_, err = database.DB.Exec(
		"UPDATE users SET password=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
		string(newHashed), user.UserID,
	)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "비밀번호 변경에 실패했습니다")
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "비밀번호가 변경되었습니다"})
}
