package models

// User represents a user in the database
type User struct {
	ID              int64  `json:"id"`
	Email           string `json:"email"`
	Password        string `json:"-"` // never expose in JSON
	Phone           string `json:"phone"`
	VendorID        string `json:"vendorId"`
	AccessKey       string `json:"accessKey"`
	SecretKey       string `json:"-"` // never expose in JSON
	NameKo          string `json:"nameKo"`
	NameEn          string `json:"nameEn"`
	Zipcode         string `json:"zipcode"`
	AddressKo       string `json:"addressKo"`
	AddressDetailKo string `json:"addressDetailKo"`
	AddressEn       string `json:"addressEn"`
	AddressDetailEn string `json:"addressDetailEn"`
	CustomsType     string `json:"customsType"`
	CustomsNumber   string `json:"customsNumber"`
	CreatedAt       string `json:"createdAt"`
	UpdatedAt       string `json:"updatedAt"`
}

// UserProfile is the safe version returned to the client
type UserProfile struct {
	ID              int64  `json:"id"`
	Email           string `json:"email"`
	Phone           string `json:"phone"`
	VendorID        string `json:"vendorId"`
	AccessKey       string `json:"accessKey"`
	HasSecret       bool   `json:"hasSecret"` // true if secret key is set
	NameKo          string `json:"nameKo"`
	NameEn          string `json:"nameEn"`
	Zipcode         string `json:"zipcode"`
	AddressKo       string `json:"addressKo"`
	AddressDetailKo string `json:"addressDetailKo"`
	AddressEn       string `json:"addressEn"`
	AddressDetailEn string `json:"addressDetailEn"`
	CustomsType     string `json:"customsType"`
	CustomsNumber   string `json:"customsNumber"`
	CreatedAt       string `json:"createdAt"`
}
