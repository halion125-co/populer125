package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"io"
)

// Encrypt encrypts plaintext using AES-256-GCM with the provided 32-byte key.
// Returns base64-encoded ciphertext (nonce prepended).
func Encrypt(key []byte, plaintext string) (string, error) {
	if len(key) != 32 {
		return "", errors.New("encryption key must be 32 bytes")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// Decrypt decrypts a base64-encoded ciphertext produced by Encrypt.
func Decrypt(key []byte, encoded string) (string, error) {
	if len(key) != 32 {
		return "", errors.New("encryption key must be 32 bytes")
	}
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", errors.New("ciphertext too short")
	}
	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}

// KeyFromString converts a string key to a fixed 32-byte slice.
// The string must be exactly 32 bytes; returns an error otherwise.
func KeyFromString(s string) ([]byte, error) {
	b := []byte(s)
	if len(b) != 32 {
		return nil, errors.New("SECRET_ENCRYPTION_KEY must be exactly 32 bytes")
	}
	return b, nil
}
