package models

// LoginRequest represents the login request payload
type LoginRequest struct {
	VendorID  string `json:"vendor_id" validate:"required"`
	AccessKey string `json:"access_key" validate:"required"`
	SecretKey string `json:"secret_key" validate:"required"`
}

// LoginResponse represents the login response payload
type LoginResponse struct {
	Token     string `json:"token"`
	VendorID  string `json:"vendor_id"`
	ExpiresAt int64  `json:"expires_at"`
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}
