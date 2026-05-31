package reportcollect

import (
	"database/sql"
	"encoding/json"
	"time"

	"github.com/rocketgrowth/backend/internal/database"
)

func CreateJob(userID int64, source, reportType, fromDate, toDate string) (int64, error) {
	res, err := database.DB.Exec(`
		INSERT INTO external_download_jobs
			(user_id, source, report_type, target_date_from, target_date_to, status, created_at)
		VALUES (?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)`,
		userID, source, reportType, fromDate, toDate,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func UpdateJobStatus(jobID int64, status JobStatus, errCode ErrorCode, msg string) error {
	now := time.Now()
	switch status {
	case JobStatusRunning:
		_, err := database.DB.Exec(
			`UPDATE external_download_jobs SET status=?, started_at=? WHERE id=?`,
			status, now, jobID,
		)
		return err
	default:
		_, err := database.DB.Exec(
			`UPDATE external_download_jobs SET status=?, error_code=?, message=?, finished_at=? WHERE id=?`,
			status, string(errCode), msg, now, jobID,
		)
		return err
	}
}

func UpdateJobSuccess(jobID int64, filePath string, recordCount int) error {
	now := time.Now()
	_, err := database.DB.Exec(
		`UPDATE external_download_jobs
		 SET status='success', downloaded_file_path=?, record_count=?, finished_at=?
		 WHERE id=?`,
		filePath, recordCount, now, jobID,
	)
	return err
}

func UpsertFile(userID, jobID int64, source, reportType, fileName, filePath, fileHash string, fileSize int64) (int64, error) {
	now := time.Now()
	res, err := database.DB.Exec(`
		INSERT INTO external_download_files
			(user_id, job_id, source, report_type, file_name, file_path, file_hash, file_size, downloaded_at, parse_status)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
		ON CONFLICT(user_id, source, report_type, file_hash) DO UPDATE SET
			job_id=excluded.job_id,
			file_name=excluded.file_name,
			file_path=excluded.file_path,
			file_size=excluded.file_size,
			downloaded_at=?`,
		userID, jobID, source, reportType, fileName, filePath, fileHash, fileSize, now, now,
	)
	if err != nil {
		return 0, err
	}
	// Fetch the id (may be existing row on conflict)
	var id int64
	err = database.DB.QueryRow(
		`SELECT id FROM external_download_files WHERE user_id=? AND source=? AND report_type=? AND file_hash=?`,
		userID, source, reportType, fileHash,
	).Scan(&id)
	_ = res
	return id, err
}

func MarkFileParsed(fileID int64) error {
	now := time.Now()
	_, err := database.DB.Exec(
		`UPDATE external_download_files SET parse_status='success', parsed_at=? WHERE id=?`,
		now, fileID,
	)
	return err
}

func UpsertRows(userID, fileID int64, source, reportType string, rows []WorkerOutputRow) (int, error) {
	tx, err := database.DB.Begin()
	if err != nil {
		return 0, err
	}
	stmt, err := tx.Prepare(`
		INSERT INTO external_report_rows
			(user_id, file_id, source, report_type, row_key, row_date, row_json, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(user_id, source, report_type, row_key) DO UPDATE SET
			file_id=excluded.file_id,
			row_date=excluded.row_date,
			row_json=excluded.row_json`)
	if err != nil {
		tx.Rollback()
		return 0, err
	}
	defer stmt.Close()

	count := 0
	for _, row := range rows {
		b, err := json.Marshal(row.Data)
		if err != nil {
			continue
		}
		if _, err := stmt.Exec(userID, fileID, source, reportType, row.RowKey, row.RowDate, string(b)); err != nil {
			tx.Rollback()
			return 0, err
		}
		count++
	}
	return count, tx.Commit()
}

func ListJobs(userID int64, source string) ([]DownloadJob, error) {
	q := `SELECT id, user_id, source, report_type, target_date_from, target_date_to,
		         status, error_code, message, downloaded_file_path, record_count,
		         started_at, finished_at, created_at
		  FROM external_download_jobs WHERE user_id=?`
	args := []interface{}{userID}
	if source != "" {
		q += " AND source=?"
		args = append(args, source)
	}
	q += " ORDER BY created_at DESC LIMIT 100"

	rows, err := database.DB.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var jobs []DownloadJob
	for rows.Next() {
		var j DownloadJob
		var startedAt, finishedAt sql.NullTime
		if err := rows.Scan(
			&j.ID, &j.UserID, &j.Source, &j.ReportType,
			&j.TargetDateFrom, &j.TargetDateTo,
			&j.Status, &j.ErrorCode, &j.Message,
			&j.DownloadedFilePath, &j.RecordCount,
			&startedAt, &finishedAt, &j.CreatedAt,
		); err != nil {
			return nil, err
		}
		if startedAt.Valid {
			j.StartedAt = &startedAt.Time
		}
		if finishedAt.Valid {
			j.FinishedAt = &finishedAt.Time
		}
		jobs = append(jobs, j)
	}
	return jobs, nil
}

func ListFiles(userID int64, source string) ([]DownloadFile, error) {
	q := `SELECT id, user_id, job_id, source, report_type, file_name, file_path,
		         file_hash, file_size, downloaded_at, parsed_at, parse_status, raw_meta_json
		  FROM external_download_files WHERE user_id=?`
	args := []interface{}{userID}
	if source != "" {
		q += " AND source=?"
		args = append(args, source)
	}
	q += " ORDER BY downloaded_at DESC LIMIT 100"

	rows, err := database.DB.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var files []DownloadFile
	for rows.Next() {
		var f DownloadFile
		var jobID sql.NullInt64
		var parsedAt sql.NullTime
		if err := rows.Scan(
			&f.ID, &f.UserID, &jobID, &f.Source, &f.ReportType,
			&f.FileName, &f.FilePath, &f.FileHash, &f.FileSize,
			&f.DownloadedAt, &parsedAt, &f.ParseStatus, &f.RawMetaJSON,
		); err != nil {
			return nil, err
		}
		if jobID.Valid {
			f.JobID = &jobID.Int64
		}
		if parsedAt.Valid {
			f.ParsedAt = &parsedAt.Time
		}
		files = append(files, f)
	}
	return files, nil
}

func ListRows(userID int64, source, reportType string, limit int) ([]ReportRow, error) {
	if limit <= 0 || limit > 1000 {
		limit = 200
	}
	rows, err := database.DB.Query(`
		SELECT id, user_id, file_id, source, report_type, row_key, row_date, row_json, created_at
		FROM external_report_rows
		WHERE user_id=? AND source=? AND report_type=?
		ORDER BY row_date DESC, id DESC
		LIMIT ?`,
		userID, source, reportType, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []ReportRow
	for rows.Next() {
		var r ReportRow
		if err := rows.Scan(
			&r.ID, &r.UserID, &r.FileID, &r.Source, &r.ReportType,
			&r.RowKey, &r.RowDate, &r.RowJSON, &r.CreatedAt,
		); err != nil {
			return nil, err
		}
		result = append(result, r)
	}
	return result, nil
}
