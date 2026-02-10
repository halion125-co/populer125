package config

import (
	"os"
)

type Config struct {
	CoupangVendorID  string
	CoupangAccessKey string
	CoupangSecretKey string
	JWTSecret        string
	DatabasePath     string
	ServerPort       string
}

func Load() *Config {
	return &Config{
		CoupangVendorID:  getEnv("COUPANG_VENDOR_ID", ""),
		CoupangAccessKey: getEnv("COUPANG_ACCESS_KEY", ""),
		CoupangSecretKey: getEnv("COUPANG_SECRET_KEY", ""),
		JWTSecret:        getEnv("JWT_SECRET", "dev-secret-key"),
		DatabasePath:     getEnv("DATABASE_PATH", "./data/rocketgrowth.db"),
		ServerPort:       getEnv("BACKEND_PORT", "8000"),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
