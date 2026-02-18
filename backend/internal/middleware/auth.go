package middleware

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/rocketgrowth/backend/internal/auth"
	"github.com/rocketgrowth/backend/internal/config"
	"github.com/rocketgrowth/backend/internal/database"
)

// UserContext holds the authenticated user info for handlers
type UserContext struct {
	UserID    int64
	Email     string
	VendorID  string
	AccessKey string
	SecretKey string
}

// JWTAuthMiddleware validates JWT tokens and loads user from DB
func JWTAuthMiddleware(cfg *config.Config) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// 1. Extract Authorization header
			authHeader := c.Request().Header.Get("Authorization")
			if authHeader == "" {
				return echo.NewHTTPError(http.StatusUnauthorized, "missing authorization header")
			}

			// 2. Parse "Bearer <token>"
			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || parts[0] != "Bearer" {
				return echo.NewHTTPError(http.StatusUnauthorized, "invalid authorization format")
			}

			// 3. Validate token
			claims, err := auth.ValidateToken(parts[1], cfg.JWTSecret)
			if err != nil {
				return echo.NewHTTPError(http.StatusUnauthorized, "invalid token")
			}

			// 4. Load user from DB to get Coupang API credentials
			var vendorID, accessKey, secretKey string
			err = database.DB.QueryRow(
				"SELECT vendor_id, access_key, secret_key FROM users WHERE id = ?",
				claims.UserID,
			).Scan(&vendorID, &accessKey, &secretKey)
			if err == sql.ErrNoRows {
				return echo.NewHTTPError(http.StatusUnauthorized, "user not found")
			}
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "database error")
			}

			// 5. Store user context for handlers
			c.Set("user", &UserContext{
				UserID:    claims.UserID,
				Email:     claims.Email,
				VendorID:  vendorID,
				AccessKey: accessKey,
				SecretKey: secretKey,
			})

			return next(c)
		}
	}
}
