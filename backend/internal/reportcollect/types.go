package reportcollect

import "time"

type JobStatus string

const (
	JobStatusPending JobStatus = "pending"
	JobStatusRunning JobStatus = "running"
	JobStatusSuccess JobStatus = "success"
	JobStatusFailed  JobStatus = "failed"
)

type ErrorCode string

const (
	ErrLoginFailed          ErrorCode = "LOGIN_FAILED"
	ErrNeedsManualAuth      ErrorCode = "NEEDS_MANUAL_AUTH"
	ErrNavigationFailed     ErrorCode = "NAVIGATION_FAILED"
	ErrDownloadButtonNotFound ErrorCode = "DOWNLOAD_BUTTON_NOT_FOUND"
	ErrDownloadFailed       ErrorCode = "DOWNLOAD_FAILED"
	ErrFileNotFound         ErrorCode = "FILE_NOT_FOUND"
	ErrParseFailed          ErrorCode = "PARSE_FAILED"
	ErrTimeout              ErrorCode = "TIMEOUT"
	ErrUnknown              ErrorCode = "UNKNOWN_ERROR"
)

type DownloadJob struct {
	ID                  int64      `json:"id"`
	UserID              int64      `json:"userId"`
	Source              string     `json:"source"`
	ReportType          string     `json:"reportType"`
	TargetDateFrom      string     `json:"targetDateFrom"`
	TargetDateTo        string     `json:"targetDateTo"`
	Status              JobStatus  `json:"status"`
	ErrorCode           string     `json:"errorCode"`
	Message             string     `json:"message"`
	DownloadedFilePath  string     `json:"downloadedFilePath"`
	RecordCount         int        `json:"recordCount"`
	StartedAt           *time.Time `json:"startedAt"`
	FinishedAt          *time.Time `json:"finishedAt"`
	CreatedAt           time.Time  `json:"createdAt"`
}

type DownloadFile struct {
	ID           int64      `json:"id"`
	UserID       int64      `json:"userId"`
	JobID        *int64     `json:"jobId"`
	Source       string     `json:"source"`
	ReportType   string     `json:"reportType"`
	FileName     string     `json:"fileName"`
	FilePath     string     `json:"filePath"`
	FileHash     string     `json:"fileHash"`
	FileSize     int64      `json:"fileSize"`
	DownloadedAt time.Time  `json:"downloadedAt"`
	ParsedAt     *time.Time `json:"parsedAt"`
	ParseStatus  string     `json:"parseStatus"`
	RawMetaJSON  string     `json:"rawMetaJson"`
}

type ReportRow struct {
	ID         int64     `json:"id"`
	UserID     int64     `json:"userId"`
	FileID     int64     `json:"fileId"`
	Source     string    `json:"source"`
	ReportType string    `json:"reportType"`
	RowKey     string    `json:"rowKey"`
	RowDate    string    `json:"rowDate"`
	RowJSON    string    `json:"rowJson"`
	CreatedAt  time.Time `json:"createdAt"`
}

// WorkerInput is written to a temp file (0600) and passed to the Python worker.
type WorkerInput struct {
	Source      string `json:"source"`
	ReportType  string `json:"reportType"`
	LoginID     string `json:"loginId"`
	LoginPw     string `json:"loginPw"`
	FromDate    string `json:"fromDate"`
	ToDate      string `json:"toDate"`
	DownloadDir string `json:"downloadDir"`
}

// WorkerOutputRow is one parsed row from the downloaded Excel.
type WorkerOutputRow struct {
	RowKey  string                 `json:"rowKey"`
	RowDate string                 `json:"rowDate"`
	Data    map[string]interface{} `json:"data"`
}

// WorkerOutput is the JSON the Python worker writes to stdout.
type WorkerOutput struct {
	Ok          bool              `json:"ok"`
	FilePath    string            `json:"filePath"`
	FileName    string            `json:"fileName"`
	FileSize    int64             `json:"fileSize"`
	FileHash    string            `json:"fileHash"`
	RecordCount int               `json:"recordCount"`
	Rows        []WorkerOutputRow `json:"rows"`
	ErrorCode   string            `json:"errorCode"`
	Message     string            `json:"message"`
}

// DownloadRequest is the API request body for triggering a download.
type DownloadRequest struct {
	FromDate string `json:"fromDate"`
	ToDate   string `json:"toDate"`
}

// DownloadResponse is the API response after triggering a download.
type DownloadResponse struct {
	Code        string `json:"code"`
	JobID       int64  `json:"jobId"`
	Source      string `json:"source"`
	ReportType  string `json:"reportType"`
	RecordCount int    `json:"recordCount"`
	Message     string `json:"message"`
}
