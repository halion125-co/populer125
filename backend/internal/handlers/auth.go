package handlers

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/rocketgrowth/backend/internal/auth"
	"github.com/rocketgrowth/backend/internal/config"
	"github.com/rocketgrowth/backend/internal/database"
	"github.com/rocketgrowth/backend/internal/models"
	"golang.org/x/crypto/bcrypt"
)

// Login handles email/password login
func Login(cfg *config.Config) echo.HandlerFunc {
	return func(c echo.Context) error {
		var req models.LoginRequest
		if err := c.Bind(&req); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "invalid request")
		}

		req.Email = strings.TrimSpace(strings.ToLower(req.Email))
		if req.Email == "" || req.Password == "" {
			return echo.NewHTTPError(http.StatusBadRequest, "이메일과 비밀번호를 입력해주세요")
		}

		// Find user by email
		var user models.User
		err := database.DB.QueryRow(
			"SELECT id, email, password, phone, vendor_id, access_key, secret_key, created_at FROM users WHERE email = ?",
			req.Email,
		).Scan(&user.ID, &user.Email, &user.Password, &user.Phone, &user.VendorID, &user.AccessKey, &user.SecretKey, &user.CreatedAt)
		if err == sql.ErrNoRows {
			return echo.NewHTTPError(http.StatusUnauthorized, "이메일 또는 비밀번호가 올바르지 않습니다")
		}
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "서버 오류가 발생했습니다")
		}

		// Verify password
		if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
			return echo.NewHTTPError(http.StatusUnauthorized, "이메일 또는 비밀번호가 올바르지 않습니다")
		}

		// Generate JWT
		expiresAt := time.Now().Add(24 * time.Hour).Unix()
		token, err := auth.GenerateToken(user.ID, user.Email, cfg.JWTSecret)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "토큰 생성에 실패했습니다")
		}

		return c.JSON(http.StatusOK, models.LoginResponse{
			Token:     token,
			ExpiresAt: expiresAt,
			User: models.UserProfile{
				ID:        user.ID,
				Email:     user.Email,
				Phone:     user.Phone,
				VendorID:  user.VendorID,
				AccessKey: user.AccessKey,
				HasSecret: user.SecretKey != "",
				CreatedAt: user.CreatedAt,
			},
		})
	}
}

// Register handles new user registration
func Register(cfg *config.Config) echo.HandlerFunc {
	return func(c echo.Context) error {
		var req models.RegisterRequest
		if err := c.Bind(&req); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "invalid request")
		}

		req.Email = strings.TrimSpace(strings.ToLower(req.Email))
		if req.Email == "" || req.Password == "" {
			return echo.NewHTTPError(http.StatusBadRequest, "이메일과 비밀번호는 필수입니다")
		}
		if len(req.Password) < 6 {
			return echo.NewHTTPError(http.StatusBadRequest, "비밀번호는 6자 이상이어야 합니다")
		}

		// Hash password
		hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "서버 오류가 발생했습니다")
		}

		// Insert user
		result, err := database.DB.Exec(
			`INSERT INTO users (email, password, phone, vendor_id, access_key, secret_key)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			req.Email, string(hashed),
			strings.TrimSpace(req.Phone),
			strings.TrimSpace(req.VendorID),
			strings.TrimSpace(req.AccessKey),
			strings.TrimSpace(req.SecretKey),
		)
		if err != nil {
			if strings.Contains(err.Error(), "UNIQUE constraint failed") {
				return echo.NewHTTPError(http.StatusConflict, "이미 사용 중인 이메일입니다")
			}
			return echo.NewHTTPError(http.StatusInternalServerError, "회원가입에 실패했습니다")
		}

		userID, _ := result.LastInsertId()

		// Generate JWT
		expiresAt := time.Now().Add(24 * time.Hour).Unix()
		token, err := auth.GenerateToken(userID, req.Email, cfg.JWTSecret)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "토큰 생성에 실패했습니다")
		}

		return c.JSON(http.StatusCreated, models.LoginResponse{
			Token:     token,
			ExpiresAt: expiresAt,
			User: models.UserProfile{
				ID:        userID,
				Email:     req.Email,
				Phone:     req.Phone,
				VendorID:  req.VendorID,
				AccessKey: req.AccessKey,
				HasSecret: req.SecretKey != "",
			},
		})
	}
}
