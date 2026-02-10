package main

import (
	"fmt"
	"net/http"

	"github.com/labstack/echo/v4"
	echomiddleware "github.com/labstack/echo/v4/middleware"
	"github.com/rocketgrowth/backend/internal/auth"
	"github.com/rocketgrowth/backend/internal/config"
	"github.com/rocketgrowth/backend/internal/coupang"
	"github.com/rocketgrowth/backend/internal/handlers"
	"github.com/rocketgrowth/backend/internal/middleware"
)

var (
	cfg           *config.Config
	coupangClient *coupang.Client
)

func main() {
	// Load configuration
	cfg = config.Load()

	// Initialize Coupang API client
	coupangClient = coupang.NewClient(cfg.CoupangVendorID, cfg.CoupangAccessKey, cfg.CoupangSecretKey)

	e := echo.New()

	// Middleware
	e.Use(echomiddleware.Logger())
	e.Use(echomiddleware.Recover())
	e.Use(echomiddleware.CORS())

	// Public routes (no authentication required)
	e.POST("/api/auth/login", handlers.Login(cfg))
	e.GET("/api/health", healthCheck)

	// Protected routes (JWT authentication required)
	api := e.Group("/api")
	api.Use(middleware.JWTAuthMiddleware(cfg))
	api.GET("/coupang/products", getProductsProtected)
	api.GET("/coupang/test", testCoupangAPI)

	// Start server
	port := fmt.Sprintf(":%s", cfg.ServerPort)
	e.Logger.Fatal(e.Start(port))
}

func healthCheck(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]interface{}{
		"status":  "ok",
		"message": "RocketGrowth API is running",
		"config": map[string]string{
			"vendor_id": cfg.CoupangVendorID,
			"has_access_key": func() string {
				if cfg.CoupangAccessKey != "" {
					return "yes"
				}
				return "no"
			}(),
		},
	})
}

func testCoupangAPI(c echo.Context) error {
	// Test Coupang API connection
	return c.JSON(http.StatusOK, map[string]string{
		"message": "Coupang API client initialized",
		"vendor_id": cfg.CoupangVendorID,
	})
}

func getProductsProtected(c echo.Context) error {
	// Extract credentials from JWT claims
	claims := c.Get("user_claims").(*auth.Claims)
	client := coupang.NewClient(claims.VendorID, claims.AccessKey, claims.SecretKey)

	data, err := client.GetProducts()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSONBlob(http.StatusOK, data)
}
