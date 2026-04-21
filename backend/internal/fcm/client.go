package fcm

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"time"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/messaging"
	"google.golang.org/api/option"
)

var client *messaging.Client

// Init initializes the Firebase messaging client. credentialsPath may be empty (FCM disabled).
func Init(credentialsPath string) error {
	if credentialsPath == "" {
		log.Println("[FCM] FCM_CREDENTIALS_PATH not set, push notifications disabled")
		return nil
	}

	app, err := firebase.NewApp(context.Background(), nil, option.WithCredentialsFile(credentialsPath))
	if err != nil {
		return fmt.Errorf("firebase init: %w", err)
	}

	client, err = app.Messaging(context.Background())
	if err != nil {
		return fmt.Errorf("firebase messaging: %w", err)
	}

	log.Println("[FCM] Firebase messaging initialized")
	return nil
}

// Enabled reports whether FCM is ready to send.
func Enabled() bool {
	return client != nil
}

// SendToUser sends a push notification to all registered devices of a user.
// Quiet hours and push_enabled are checked against the notification_settings table.
// db is passed directly to avoid a circular dependency on the database package.
func SendToUser(db *sql.DB, userID int64, title string, data map[string]string) error {
	if client == nil {
		return nil
	}

	// Check notification settings
	var pushEnabled int
	var quietStart, quietEnd string
	err := db.QueryRow(
		"SELECT push_enabled, quiet_start, quiet_end FROM notification_settings WHERE user_id = ?",
		userID,
	).Scan(&pushEnabled, &quietStart, &quietEnd)
	if err != nil && err != sql.ErrNoRows {
		return fmt.Errorf("notification settings query: %w", err)
	}

	// Default push_enabled = 1 when no row exists
	if err == sql.ErrNoRows {
		pushEnabled = 1
	}

	if pushEnabled == 0 {
		return nil
	}

	// Check quiet hours (KST)
	if quietStart != "" && quietEnd != "" {
		loc, _ := time.LoadLocation("Asia/Seoul")
		now := time.Now().In(loc)
		nowMin := now.Hour()*60 + now.Minute()

		startMin := parseHHMM(quietStart)
		endMin := parseHHMM(quietEnd)

		inQuiet := false
		if startMin <= endMin {
			inQuiet = nowMin >= startMin && nowMin < endMin
		} else {
			// overnight range (e.g., 22:00 ~ 08:00)
			inQuiet = nowMin >= startMin || nowMin < endMin
		}

		if inQuiet {
			return nil
		}
	}

	// Collect FCM tokens
	rows, err := db.Query("SELECT fcm_token FROM device_tokens WHERE user_id = ?", userID)
	if err != nil {
		return fmt.Errorf("device tokens query: %w", err)
	}
	defer rows.Close()

	var tokens []string
	for rows.Next() {
		var tok string
		if err := rows.Scan(&tok); err == nil {
			tokens = append(tokens, tok)
		}
	}

	if len(tokens) == 0 {
		return nil
	}

	// Build body from data fields for display
	body := data["body"]
	if body == "" {
		body = data["detail"]
	}

	msg := &messaging.MulticastMessage{
		Tokens: tokens,
		Notification: &messaging.Notification{
			Title: title,
			Body:  body,
		},
		Data: data,
		Android: &messaging.AndroidConfig{
			Priority: "high",
			Notification: &messaging.AndroidNotification{
				ChannelID:  "orders",
				Sound:      "default",
				Priority:   messaging.PriorityHigh,
				Visibility: messaging.VisibilityPublic,
			},
		},
		APNS: &messaging.APNSConfig{
			Headers: map[string]string{
				"apns-priority": "10",
			},
			Payload: &messaging.APNSPayload{
				Aps: &messaging.Aps{
					Sound:            "default",
					ContentAvailable: true,
				},
			},
		},
	}

	br, err := client.SendEachForMulticast(context.Background(), msg)
	if err != nil {
		return fmt.Errorf("FCM send: %w", err)
	}

	log.Printf("[FCM] user=%d 발송 완료: 성공=%d 실패=%d 토큰수=%d", userID, br.SuccessCount, br.FailureCount, len(tokens))

	// Remove stale tokens
	for i, resp := range br.Responses {
		if !resp.Success && messaging.IsRegistrationTokenNotRegistered(resp.Error) {
			log.Printf("[FCM] user=%d 만료된 토큰 삭제: %s", userID, tokens[i][:20]+"...")
			db.Exec("DELETE FROM device_tokens WHERE user_id = ? AND fcm_token = ?", userID, tokens[i])
		}
	}

	return nil
}

// SaveHistory inserts a push notification record into push_notification_history.
func SaveHistory(db *sql.DB, userID int64, title string, totalQty int, totalAmount float64, lines []string) error {
	detailJSON, err := json.Marshal(lines)
	if err != nil {
		return err
	}
	_, err = db.Exec(
		"INSERT INTO push_notification_history (user_id, title, total_qty, total_amount, detail_json) VALUES (?, ?, ?, ?, ?)",
		userID, title, totalQty, totalAmount, string(detailJSON),
	)
	return err
}

func parseHHMM(s string) int {
	if len(s) != 5 {
		return 0
	}
	h, m := 0, 0
	fmt.Sscanf(s, "%d:%d", &h, &m)
	return h*60 + m
}
