package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt"
)

// Claims represents the JWT claims structure
type Claims struct {
	UserID         int64  `json:"user_id"`
	Email          string `json:"email"`
	ImpersonatedBy int64  `json:"impersonated_by,omitempty"`
	jwt.StandardClaims
}

// GenerateToken creates a new JWT token with the given user info
func GenerateToken(userID int64, email, jwtSecret string) (string, error) {
	expirationTime := time.Now().Add(24 * time.Hour)

	claims := &Claims{
		UserID: userID,
		Email:  email,
		StandardClaims: jwt.StandardClaims{
			ExpiresAt: expirationTime.Unix(),
			IssuedAt:  time.Now().Unix(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(jwtSecret))
	if err != nil {
		return "", err
	}

	return tokenString, nil
}

// GenerateImpersonationToken creates a 2-hour token for admin impersonating targetUserID.
func GenerateImpersonationToken(targetUserID int64, targetEmail string, adminUserID int64, jwtSecret string) (string, error) {
	claims := &Claims{
		UserID:         targetUserID,
		Email:          targetEmail,
		ImpersonatedBy: adminUserID,
		StandardClaims: jwt.StandardClaims{
			ExpiresAt: time.Now().Add(2 * time.Hour).Unix(),
			IssuedAt:  time.Now().Unix(),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(jwtSecret))
}

// RefreshToken parses an expired token (within graceDays) and issues a new 24h token.
func RefreshToken(tokenString, jwtSecret string, graceDays int) (string, error) {
	claims := &Claims{}
	_, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("invalid signing method")
		}
		return []byte(jwtSecret), nil
	})

	// Allow ValidationErrorExpired only
	if err != nil {
		ve, ok := err.(*jwt.ValidationError)
		if !ok || ve.Errors&jwt.ValidationErrorExpired == 0 {
			return "", errors.New("invalid token")
		}
	}

	// Reject if issued more than graceDays ago
	issuedAt := time.Unix(claims.IssuedAt, 0)
	if time.Since(issuedAt) > time.Duration(graceDays)*24*time.Hour {
		return "", errors.New("token too old to refresh")
	}

	return GenerateToken(claims.UserID, claims.Email, jwtSecret)
}

// ValidateToken validates the JWT token and returns the claims
func ValidateToken(tokenString, jwtSecret string) (*Claims, error) {
	claims := &Claims{}

	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("invalid signing method")
		}
		return []byte(jwtSecret), nil
	})

	if err != nil {
		return nil, err
	}

	if !token.Valid {
		return nil, errors.New("invalid token")
	}

	return claims, nil
}
