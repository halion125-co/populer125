package handlers

import (
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/rocketgrowth/backend/internal/auth"
	"github.com/rocketgrowth/backend/internal/config"
)

// RefreshToken issues a new 24h JWT for mobile auto-login.
// Accepts tokens expired within the last 7 days.
func RefreshToken(cfg *config.Config) echo.HandlerFunc {
	return func(c echo.Context) error {
		authHeader := c.Request().Header.Get("Authorization")
		if !strings.HasPrefix(authHeader, "Bearer ") {
			return echo.NewHTTPError(http.StatusUnauthorized, "토큰이 없습니다")
		}
		tokenString := strings.TrimPrefix(authHeader, "Bearer ")

		newToken, err := auth.RefreshToken(tokenString, cfg.JWTSecret, 7)
		if err != nil {
			return echo.NewHTTPError(http.StatusUnauthorized, "토큰을 갱신할 수 없습니다: "+err.Error())
		}

		return c.JSON(http.StatusOK, map[string]interface{}{
			"token":      newToken,
			"expires_at": time.Now().Add(24 * time.Hour).Unix(),
		})
	}
}
