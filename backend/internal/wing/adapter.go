package wing

import (
	"database/sql"
	"fmt"

	appCrypto "github.com/rocketgrowth/backend/internal/crypto"
	"github.com/rocketgrowth/backend/internal/database"
)

type Credentials struct {
	LoginID string
	LoginPw string
}

// GetCredentials fetches and decrypts the Wing credentials for a user.
func GetCredentials(userID int64, encKey []byte) (*Credentials, error) {
	var wingID, wingPwEnc string
	err := database.DB.QueryRow(
		`SELECT wing_id, wing_pw_enc FROM users WHERE id=?`, userID,
	).Scan(&wingID, &wingPwEnc)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("user not found")
	}
	if err != nil {
		return nil, err
	}
	if wingID == "" || wingPwEnc == "" {
		return nil, fmt.Errorf("wing credentials not configured")
	}
	pw, err := appCrypto.Decrypt(encKey, wingPwEnc)
	if err != nil {
		return nil, fmt.Errorf("decrypt wing password: %w", err)
	}
	return &Credentials{LoginID: wingID, LoginPw: pw}, nil
}

// SaveCredentials encrypts and stores Wing credentials for a user.
func SaveCredentials(userID int64, loginID, loginPw string, encKey []byte) error {
	enc, err := appCrypto.Encrypt(encKey, loginPw)
	if err != nil {
		return fmt.Errorf("encrypt wing password: %w", err)
	}
	_, err = database.DB.Exec(
		`UPDATE users SET wing_id=?, wing_pw_enc=?, wing_pw_updated_at=CURRENT_TIMESTAMP WHERE id=?`,
		loginID, enc, userID,
	)
	return err
}

// HasCredentials returns true if wing_id and wing_pw_enc are non-empty.
func HasCredentials(userID int64) (bool, error) {
	var wingID, wingPwEnc string
	err := database.DB.QueryRow(
		`SELECT wing_id, wing_pw_enc FROM users WHERE id=?`, userID,
	).Scan(&wingID, &wingPwEnc)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return wingID != "" && wingPwEnc != "", nil
}
