package reportcollect

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// workerHTTPRequest is the JSON body sent to the Python worker HTTP server.
type workerHTTPRequest struct {
	Source      string `json:"source"`
	ReportType  string `json:"reportType"`
	LoginID     string `json:"loginId"`
	LoginPw     string `json:"loginPw"`
	FromDate    string `json:"fromDate"`
	ToDate      string `json:"toDate"`
	DownloadDir string `json:"downloadDir"`
}

// RunWorker calls the Python worker HTTP server and returns the parsed result.
func RunWorker(ctx context.Context, workerServerURL string, input WorkerInput, timeoutSec int) (*WorkerOutput, error) {
	timeout := time.Duration(timeoutSec) * time.Second
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	reqBody := workerHTTPRequest{
		Source:      input.Source,
		ReportType:  input.ReportType,
		LoginID:     input.LoginID,
		LoginPw:     input.LoginPw,
		FromDate:    input.FromDate,
		ToDate:      input.ToDate,
		DownloadDir: input.DownloadDir,
	}

	b, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal worker request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", workerServerURL+"/run", bytes.NewReader(b))
	if err != nil {
		return nil, fmt.Errorf("create http request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(httpReq)
	if ctx.Err() == context.DeadlineExceeded {
		return &WorkerOutput{Ok: false, ErrorCode: string(ErrTimeout), Message: "worker timed out"}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("call worker server: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read worker response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return &WorkerOutput{
			Ok:        false,
			ErrorCode: string(ErrUnknown),
			Message:   fmt.Sprintf("worker server returned %d: %s", resp.StatusCode, string(respBytes)),
		}, nil
	}

	var result WorkerOutput
	if err := json.Unmarshal(respBytes, &result); err != nil {
		return nil, fmt.Errorf("parse worker response: %w", err)
	}
	return &result, nil
}
