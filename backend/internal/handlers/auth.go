package handlers

import (
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/rocketgrowth/backend/internal/auth"
	"github.com/rocketgrowth/backend/internal/config"
	"github.com/rocketgrowth/backend/internal/coupang"
	"github.com/rocketgrowth/backend/internal/models"
)

// Login handles the login request
func Login(cfg *config.Config) echo.HandlerFunc {
	return func(c echo.Context) error {
		var req models.LoginRequest

		// 1. Bind and validate request
		if err := c.Bind(&req); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Invalid request")
		}

		// Validate required fields
		if req.VendorID == "" || req.AccessKey == "" || req.SecretKey == "" {
			return echo.NewHTTPError(http.StatusBadRequest, "All fields are required")
		}

		// 2. Validate credentials by testing Coupang API call
		tempClient := coupang.NewClient(req.VendorID, req.AccessKey, req.SecretKey)
		_, err := tempClient.GetProducts()
		if err != nil {
			return echo.NewHTTPError(http.StatusUnauthorized, "Invalid credentials")
		}

		// 3. Generate JWT token
		expiresAt := time.Now().Add(24 * time.Hour).Unix()
		token, err := auth.GenerateToken(req.VendorID, req.AccessKey, req.SecretKey, cfg.JWTSecret)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to generate token")
		}

		// 4. Return response
		return c.JSON(http.StatusOK, models.LoginResponse{
			Token:     token,
			VendorID:  req.VendorID,
			ExpiresAt: expiresAt,
		})
	}
}
