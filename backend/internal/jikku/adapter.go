package jikku

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

// GetCredentials fetches and decrypts the 직꾸 credentials for a user.
func GetCredentials(userID int64, encKey []byte) (*Credentials, error) {
	var jikkuID, jikkuPwEnc string
	err := database.DB.QueryRow(
		`SELECT jikku_id, jikku_pw_enc FROM users WHERE id=?`, userID,
	).Scan(&jikkuID, &jikkuPwEnc)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("user not found")
	}
	if err != nil {
		return nil, err
	}
	if jikkuID == "" || jikkuPwEnc == "" {
		return nil, fmt.Errorf("jikku credentials not configured")
	}
	pw, err := appCrypto.Decrypt(encKey, jikkuPwEnc)
	if err != nil {
		return nil, fmt.Errorf("decrypt jikku password: %w", err)
	}
	return &Credentials{LoginID: jikkuID, LoginPw: pw}, nil
}

// SaveCredentials encrypts and stores 직꾸 credentials for a user.
func SaveCredentials(userID int64, loginID, loginPw string, encKey []byte) error {
	enc, err := appCrypto.Encrypt(encKey, loginPw)
	if err != nil {
		return fmt.Errorf("encrypt jikku password: %w", err)
	}
	_, err = database.DB.Exec(
		`UPDATE users SET jikku_id=?, jikku_pw_enc=?, jikku_pw_updated_at=CURRENT_TIMESTAMP WHERE id=?`,
		loginID, enc, userID,
	)
	return err
}

// HasCredentials returns true if jikku_id and jikku_pw_enc are non-empty.
func HasCredentials(userID int64) (bool, error) {
	var jikkuID, jikkuPwEnc string
	err := database.DB.QueryRow(
		`SELECT jikku_id, jikku_pw_enc FROM users WHERE id=?`, userID,
	).Scan(&jikkuID, &jikkuPwEnc)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return jikkuID != "" && jikkuPwEnc != "", nil
}
