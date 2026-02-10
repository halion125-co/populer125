package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt"
)

// Claims represents the JWT claims structure
type Claims struct {
	VendorID  string `json:"vendor_id"`
	AccessKey string `json:"access_key"`
	SecretKey string `json:"secret_key"`
	jwt.StandardClaims
}

// GenerateToken creates a new JWT token with the given credentials
func GenerateToken(vendorID, accessKey, secretKey, jwtSecret string) (string, error) {
	expirationTime := time.Now().Add(24 * time.Hour)

	claims := &Claims{
		VendorID:  vendorID,
		AccessKey: accessKey,
		SecretKey: secretKey,
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
