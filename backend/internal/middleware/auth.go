package middleware

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/rocketgrowth/backend/internal/auth"
	"github.com/rocketgrowth/backend/internal/config"
)

// JWTAuthMiddleware validates JWT tokens and protects routes
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

			// 4. Store claims in context for handlers to use
			c.Set("user_claims", claims)

			return next(c)
		}
	}
}
