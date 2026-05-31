package aianalyze

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/rocketgrowth/backend/internal/database"
)

const (
	maxRows        = 300
	geminiModel    = "gemini-2.5-flash-lite"
	// 무료 티어: 분당 15 요청, 일 1500 요청
	rateLimitPerMin = 14 // 여유 1개
	rateLimitPerDay = 1400
)

type Service struct {
	APIKey string
}

// rate limiter (in-memory, 단일 인스턴스 기준)
var (
	rmu          sync.Mutex
	minRequests  []time.Time
	dayRequests  []time.Time
)

func checkRateLimit() error {
	rmu.Lock()
	defer rmu.Unlock()

	now := time.Now()

	// 1분 윈도우 정리
	cutMin := now.Add(-time.Minute)
	filtered := minRequests[:0]
	for _, t := range minRequests {
		if t.After(cutMin) {
			filtered = append(filtered, t)
		}
	}
	minRequests = filtered

	// 1일 윈도우 정리
	cutDay := now.Add(-24 * time.Hour)
	filteredDay := dayRequests[:0]
	for _, t := range dayRequests {
		if t.After(cutDay) {
			filteredDay = append(filteredDay, t)
		}
	}
	dayRequests = filteredDay

	if len(minRequests) >= rateLimitPerMin {
		return fmt.Errorf("분당 요청 한도(%d회)에 도달했습니다. 잠시 후 다시 시도해주세요.", rateLimitPerMin)
	}
	if len(dayRequests) >= rateLimitPerDay {
		return fmt.Errorf("일일 요청 한도(%d회)에 도달했습니다. 내일 다시 시도해주세요.", rateLimitPerDay)
	}

	minRequests = append(minRequests, now)
	dayRequests = append(dayRequests, now)
	return nil
}

type AnalyzeRequest struct {
	Source     string `json:"source"`
	ReportType string `json:"reportType"`
	Question   string `json:"question"`
}

type AnalyzeResponse struct {
	Answer    string `json:"answer"`
	RowCount  int    `json:"rowCount"`
	Model     string `json:"model"`
	CreatedAt string `json:"createdAt"`
}

func (s *Service) Analyze(ctx context.Context, userID int64, req AnalyzeRequest) (*AnalyzeResponse, error) {
	if err := checkRateLimit(); err != nil {
		return nil, err
	}

	rows, err := fetchRows(userID, req.Source, req.ReportType)
	if err != nil {
		return nil, fmt.Errorf("fetch rows: %w", err)
	}
	if len(rows) == 0 {
		return nil, fmt.Errorf("수집된 데이터가 없습니다. 먼저 데이터 수집을 실행해주세요.")
	}
	if len(rows) > maxRows {
		rows = rows[:maxRows]
	}

	dataJSON, err := json.Marshal(rows)
	if err != nil {
		return nil, fmt.Errorf("marshal rows: %w", err)
	}

	prompt := buildPrompt(req.Source, req.ReportType, req.Question, string(dataJSON))

	answer, err := s.callGemini(ctx, prompt)
	if err != nil {
		return nil, fmt.Errorf("Gemini 호출 실패: %w", err)
	}

	return &AnalyzeResponse{
		Answer:    answer,
		RowCount:  len(rows),
		Model:     geminiModel,
		CreatedAt: time.Now().Format(time.RFC3339),
	}, nil
}

func fetchRows(userID int64, source, reportType string) ([]map[string]interface{}, error) {
	rows, err := database.DB.Query(`
		SELECT row_json FROM external_report_rows
		WHERE user_id=? AND source=? AND report_type=?
		ORDER BY row_date DESC, id DESC
		LIMIT ?`,
		userID, source, reportType, maxRows,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []map[string]interface{}
	for rows.Next() {
		var raw string
		if err := rows.Scan(&raw); err != nil {
			continue
		}
		var m map[string]interface{}
		if err := json.Unmarshal([]byte(raw), &m); err != nil {
			continue
		}
		result = append(result, m)
	}
	return result, nil
}

func buildPrompt(source, reportType, question, dataJSON string) string {
	sourceLabel := map[string]string{
		"wing":  "쿠팡 Wing",
		"jikku": "직꾸",
	}[source]
	if sourceLabel == "" {
		sourceLabel = source
	}

	reportLabel := map[string]string{
		"rocket_growth_inventory_status": "로켓그로스 재고현황",
		"jikku_order_status":             "직꾸 주문현황",
		"jikku_inbound_history":          "직꾸 입고내역",
		"jikku_inventory_status":         "직꾸 재고현황",
	}[reportType]
	if reportLabel == "" {
		reportLabel = reportType
	}

	return strings.TrimSpace(fmt.Sprintf(`
당신은 이커머스 재고/판매 데이터 분석 전문가입니다.
아래는 %s의 %s 데이터입니다 (JSON 배열, 각 항목은 엑셀 한 행):

%s

위 데이터를 바탕으로 다음 질문에 한국어로 답해주세요:
%s

- 수치는 구체적으로 언급해주세요.
- 표가 필요하면 마크다운 표로 작성해주세요.
- 답변은 간결하고 실무적으로 작성해주세요.
`, sourceLabel, reportLabel, dataJSON, question))
}

func (s *Service) callGemini(ctx context.Context, prompt string) (string, error) {
	url := fmt.Sprintf(
		"https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s",
		geminiModel, s.APIKey,
	)

	body := map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"parts": []map[string]string{
					{"text": prompt},
				},
			},
		},
		"generationConfig": map[string]interface{}{
			"maxOutputTokens": 2048,
			"temperature":     0.2,
		},
	}
	b, _ := json.Marshal(body)

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(b))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("Gemini API error %d: %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", fmt.Errorf("parse response: %w", err)
	}
	if len(result.Candidates) == 0 || len(result.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("no content in response")
	}
	return result.Candidates[0].Content.Parts[0].Text, nil
}
