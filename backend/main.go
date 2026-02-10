package main

import (
	"fmt"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/rocketgrowth/backend/internal/config"
	"github.com/rocketgrowth/backend/internal/coupang"
)

var (
	cfg           *config.Config
	coupangClient *coupang.Client
)

func main() {
	// Load configuration
	cfg = config.Load()

	// Initialize Coupang API client
	coupangClient = coupang.NewClient(cfg.CoupangAccessKey, cfg.CoupangSecretKey)

	e := echo.New()

	// Middleware
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORS())

	// Routes
	e.GET("/api/health", healthCheck)
	e.GET("/api/coupang/products", getProducts)
	e.GET("/api/coupang/test", testCoupangAPI)

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

func getProducts(c echo.Context) error {
	data, err := coupangClient.GetProducts()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSONBlob(http.StatusOK, data)
}
