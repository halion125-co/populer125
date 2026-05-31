package reportcollect

import (
	"context"
	"fmt"
	"path/filepath"
)

// Service coordinates job creation, worker execution, and result persistence.
type Service struct {
	EncryptionKey    []byte
	DownloadBaseDir  string
	WorkerTimeoutSec int
	WorkerServerURL  string
}

// Run creates a job, executes the worker synchronously, and stores results.
// loginID and loginPw are the already-decrypted credentials.
func (s *Service) Run(
	ctx context.Context,
	userID int64,
	source, reportType string,
	loginID, loginPw string,
	fromDate, toDate string,
) (*DownloadResponse, error) {
	// 1. Create job record
	jobID, err := CreateJob(userID, source, reportType, fromDate, toDate)
	if err != nil {
		return nil, fmt.Errorf("create job: %w", err)
	}

	_ = UpdateJobStatus(jobID, JobStatusRunning, "", "")

	downloadDir := filepath.Join(s.DownloadBaseDir, fmt.Sprintf("user-%d", userID), fmt.Sprintf("job-%d", jobID))

	input := WorkerInput{
		Source:      source,
		ReportType:  reportType,
		LoginID:     loginID,
		LoginPw:     loginPw,
		FromDate:    fromDate,
		ToDate:      toDate,
		DownloadDir: downloadDir,
	}

	// 2. Execute worker via HTTP
	result, err := RunWorker(ctx, s.WorkerServerURL, input, s.WorkerTimeoutSec)
	if err != nil {
		_ = UpdateJobStatus(jobID, JobStatusFailed, ErrUnknown, err.Error())
		return &DownloadResponse{
			Code: "FAILED", JobID: jobID, Source: source, ReportType: reportType,
			Message: err.Error(),
		}, nil
	}

	if !result.Ok {
		errCode := ErrorCode(result.ErrorCode)
		if errCode == "" {
			errCode = ErrUnknown
		}
		_ = UpdateJobStatus(jobID, JobStatusFailed, errCode, result.Message)
		return &DownloadResponse{
			Code: "FAILED", JobID: jobID, Source: source, ReportType: reportType,
			Message: result.Message,
		}, nil
	}

	// 3. Persist file metadata
	fileID, err := UpsertFile(
		userID, jobID, source, reportType,
		result.FileName, result.FilePath, result.FileHash, result.FileSize,
	)
	if err != nil {
		_ = UpdateJobStatus(jobID, JobStatusFailed, ErrUnknown, "upsert file: "+err.Error())
		return &DownloadResponse{
			Code: "FAILED", JobID: jobID, Source: source, ReportType: reportType,
			Message: "db error",
		}, nil
	}

	// 4. Persist rows
	count, err := UpsertRows(userID, fileID, source, reportType, result.Rows)
	if err != nil {
		_ = UpdateJobStatus(jobID, JobStatusFailed, ErrUnknown, "upsert rows: "+err.Error())
		return &DownloadResponse{
			Code: "FAILED", JobID: jobID, Source: source, ReportType: reportType,
			Message: "db error",
		}, nil
	}

	_ = MarkFileParsed(fileID)
	_ = UpdateJobSuccess(jobID, result.FilePath, count)

	return &DownloadResponse{
		Code:        "SUCCESS",
		JobID:       jobID,
		Source:      source,
		ReportType:  reportType,
		RecordCount: count,
		Message:     "download completed",
	}, nil
}
