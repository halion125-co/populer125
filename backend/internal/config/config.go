package config

import (
	"os"
)

type Config struct {
	CoupangVendorID    string
	CoupangAccessKey   string
	CoupangSecretKey   string
	JWTSecret          string
	DatabasePath       string
	ServerPort         string
	FCMCredentialsPath string
	AdminEmail         string
}

func Load() *Config {
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		panic("JWT_SECRET environment variable must be set")
	}

	return &Config{
		CoupangVendorID:    getEnv("COUPANG_VENDOR_ID", ""),
		CoupangAccessKey:   getEnv("COUPANG_ACCESS_KEY", ""),
		CoupangSecretKey:   getEnv("COUPANG_SECRET_KEY", ""),
		JWTSecret:          jwtSecret,
		DatabasePath:       getEnv("DATABASE_PATH", "./data/rocketgrowth.db"),
		ServerPort:         getEnv("BACKEND_PORT", "8000"),
		FCMCredentialsPath: getEnv("FCM_CREDENTIALS_PATH", ""),
		AdminEmail:         os.Getenv("ADMIN_EMAIL"),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
