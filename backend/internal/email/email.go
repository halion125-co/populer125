package email

import (
	"crypto/tls"
	"fmt"
	"net/smtp"

	"github.com/rocketgrowth/backend/internal/config"
)

func SendPasswordResetEmail(cfg *config.Config, toEmail, tempPassword string) error {
	if cfg.SMTPUser == "" || cfg.SMTPPassword == "" {
		return fmt.Errorf("SMTP 설정이 없습니다")
	}

	from := cfg.SMTPFrom
	if from == "" {
		from = cfg.SMTPUser
	}

	subject := "[RocketGrowth] 임시 비밀번호 발급 안내"
	body := fmt.Sprintf(`안녕하세요, RocketGrowth입니다.

임시 비밀번호가 발급되었습니다.

임시 비밀번호: %s

로그인 후 반드시 새 비밀번호로 변경해주세요.
본인이 요청하지 않으셨다면 이 메일을 무시해 주세요.`, tempPassword)

	msg := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s",
		from, toEmail, subject, body)

	addr := fmt.Sprintf("%s:%s", cfg.SMTPHost, cfg.SMTPPort)
	auth := smtp.PlainAuth("", cfg.SMTPUser, cfg.SMTPPassword, cfg.SMTPHost)

	// TLS (587 STARTTLS)
	if cfg.SMTPPort == "587" {
		conn, err := smtp.Dial(addr)
		if err != nil {
			return fmt.Errorf("SMTP 연결 실패: %w", err)
		}
		defer conn.Close()

		tlsConfig := &tls.Config{ServerName: cfg.SMTPHost}
		if err := conn.StartTLS(tlsConfig); err != nil {
			return fmt.Errorf("STARTTLS 실패: %w", err)
		}
		if err := conn.Auth(auth); err != nil {
			return fmt.Errorf("SMTP 인증 실패: %w", err)
		}
		if err := conn.Mail(from); err != nil {
			return err
		}
		if err := conn.Rcpt(toEmail); err != nil {
			return err
		}
		w, err := conn.Data()
		if err != nil {
			return err
		}
		defer w.Close()
		_, err = fmt.Fprint(w, msg)
		return err
	}

	// SSL (465) or plain (25)
	return smtp.SendMail(addr, auth, from, []string{toEmail}, []byte(msg))
}
