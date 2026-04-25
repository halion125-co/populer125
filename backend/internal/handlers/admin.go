package handlers

import (
	"database/sql"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/rocketgrowth/backend/internal/auth"
	"github.com/rocketgrowth/backend/internal/config"
	"github.com/rocketgrowth/backend/internal/database"
	"github.com/rocketgrowth/backend/internal/middleware"
	"github.com/rocketgrowth/backend/internal/models"
)

type UserListItem struct {
	ID        int64  `json:"id"`
	Email     string `json:"email"`
	NameKo    string `json:"nameKo"`
	Phone     string `json:"phone"`
	VendorID  string `json:"vendorId"`
	CreatedAt string `json:"createdAt"`
}

// GetAdminUsers returns all users (admin only).
func GetAdminUsers(c echo.Context) error {
	rows, err := database.DB.Query(
		"SELECT id, email, name_ko, phone, vendor_id, created_at FROM users ORDER BY id",
	)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "database error")
	}
	defer rows.Close()

	users := []UserListItem{}
	for rows.Next() {
		var u UserListItem
		if err := rows.Scan(&u.ID, &u.Email, &u.NameKo, &u.Phone, &u.VendorID, &u.CreatedAt); err != nil {
			continue
		}
		users = append(users, u)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"users": users})
}

// ImpersonateUser issues a short-lived token for the target user (admin only).
func ImpersonateUser(cfg *config.Config) echo.HandlerFunc {
	return func(c echo.Context) error {
		adminCtx := c.Get("user").(*middleware.UserContext)

		targetID, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "invalid user id")
		}

		var targetUser models.UserProfile
		var secretKey string
		var isAdmin int
		err = database.DB.QueryRow(
			`SELECT id, email, phone, vendor_id, access_key, secret_key,
			        name_ko, name_en, zipcode,
			        address_ko, address_detail_ko, address_en, address_detail_en,
			        customs_type, customs_number, created_at, is_admin
			 FROM users WHERE id = ?`, targetID,
		).Scan(
			&targetUser.ID, &targetUser.Email, &targetUser.Phone,
			&targetUser.VendorID, &targetUser.AccessKey, &secretKey,
			&targetUser.NameKo, &targetUser.NameEn, &targetUser.Zipcode,
			&targetUser.AddressKo, &targetUser.AddressDetailKo,
			&targetUser.AddressEn, &targetUser.AddressDetailEn,
			&targetUser.CustomsType, &targetUser.CustomsNumber,
			&targetUser.CreatedAt, &isAdmin,
		)
		if err == sql.ErrNoRows {
			return echo.NewHTTPError(http.StatusNotFound, "user not found")
		}
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "database error")
		}
		targetUser.HasSecret = secretKey != ""
		targetUser.IsAdmin = isAdmin == 1

		token, err := auth.GenerateImpersonationToken(targetUser.ID, targetUser.Email, adminCtx.UserID, cfg.JWTSecret)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "token generation failed")
		}

		return c.JSON(http.StatusOK, map[string]interface{}{
			"token": token,
			"user":  targetUser,
		})
	}
}
