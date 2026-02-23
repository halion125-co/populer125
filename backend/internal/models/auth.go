package models

// LoginRequest represents the login request payload (email/password)
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// RegisterRequest represents the registration request payload
type RegisterRequest struct {
	Email     string `json:"email"`
	Password  string `json:"password"`
	Phone     string `json:"phone"`
	VendorID  string `json:"vendorId"`
	AccessKey string `json:"accessKey"`
	SecretKey string `json:"secretKey"`
}

// LoginResponse represents the login/register response payload
type LoginResponse struct {
	Token     string      `json:"token"`
	ExpiresAt int64       `json:"expiresAt"`
	User      UserProfile `json:"user"`
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

// UpdateProfileRequest represents a profile update request
type UpdateProfileRequest struct {
	Email           string `json:"email"`
	Phone           string `json:"phone"`
	VendorID        string `json:"vendorId"`
	AccessKey       string `json:"accessKey"`
	SecretKey       string `json:"secretKey"`
	NameKo          string `json:"nameKo"`
	NameEn          string `json:"nameEn"`
	Zipcode         string `json:"zipcode"`
	AddressKo       string `json:"addressKo"`
	AddressDetailKo string `json:"addressDetailKo"`
	AddressEn       string `json:"addressEn"`
	AddressDetailEn string `json:"addressDetailEn"`
	CustomsType     string `json:"customsType"`
	CustomsNumber   string `json:"customsNumber"`
}

// ChangePasswordRequest represents a password change request
type ChangePasswordRequest struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}
