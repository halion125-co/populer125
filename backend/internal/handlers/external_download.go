package handlers

import (
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	appCrypto "github.com/rocketgrowth/backend/internal/crypto"
	"github.com/rocketgrowth/backend/internal/jikku"
	"github.com/rocketgrowth/backend/internal/middleware"
	"github.com/rocketgrowth/backend/internal/reportcollect"
	"github.com/rocketgrowth/backend/internal/wing"
)

type ExternalDownloadHandlers struct {
	svc *reportcollect.Service
	key []byte
}

func NewExternalDownloadHandlers(encryptionKey, downloadBaseDir, workerServerURL string, workerTimeoutSec int) (*ExternalDownloadHandlers, error) {
	key, err := appCrypto.KeyFromString(encryptionKey)
	if err != nil {
		return nil, err
	}
	return &ExternalDownloadHandlers{
		svc: &reportcollect.Service{
			EncryptionKey:    key,
			DownloadBaseDir:  downloadBaseDir,
			WorkerTimeoutSec: workerTimeoutSec,
			WorkerServerURL:  workerServerURL,
		},
		key: key,
	}, nil
}

// TriggerDownload handles POST /api/external-download/:source/:reportType
func (h *ExternalDownloadHandlers) TriggerDownload(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)
	source := c.Param("source")
	reportType := c.Param("reportType")

	var req reportcollect.DownloadRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	var loginID, loginPw string
	switch source {
	case "wing":
		creds, err := wing.GetCredentials(user.UserID, h.key)
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "wing 계정 미설정: "+err.Error())
		}
		loginID, loginPw = creds.LoginID, creds.LoginPw
	case "jikku":
		creds, err := jikku.GetCredentials(user.UserID, h.key)
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "직꾸 계정 미설정: "+err.Error())
		}
		loginID, loginPw = creds.LoginID, creds.LoginPw
	default:
		return echo.NewHTTPError(http.StatusBadRequest, "unknown source: "+source)
	}

	resp, err := h.svc.Run(c.Request().Context(), user.UserID, source, reportType, loginID, loginPw, req.FromDate, req.ToDate)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, resp)
}

// GetJobs handles GET /api/external-download/jobs
func (h *ExternalDownloadHandlers) GetJobs(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)
	source := c.QueryParam("source")

	jobs, err := reportcollect.ListJobs(user.UserID, source)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if jobs == nil {
		jobs = []reportcollect.DownloadJob{}
	}
	return c.JSON(http.StatusOK, jobs)
}

// GetFiles handles GET /api/external-download/files
func (h *ExternalDownloadHandlers) GetFiles(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)
	source := c.QueryParam("source")

	files, err := reportcollect.ListFiles(user.UserID, source)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if files == nil {
		files = []reportcollect.DownloadFile{}
	}
	return c.JSON(http.StatusOK, files)
}

// GetRows handles GET /api/external-report/:source/:reportType/rows
func (h *ExternalDownloadHandlers) GetRows(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)
	source := c.Param("source")
	reportType := c.Param("reportType")

	limit := 200
	if l := c.QueryParam("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil {
			limit = v
		}
	}

	rows, err := reportcollect.ListRows(user.UserID, source, reportType, limit)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if rows == nil {
		rows = []reportcollect.ReportRow{}
	}
	return c.JSON(http.StatusOK, rows)
}

// SaveWingCredentials handles PUT /api/external-credentials/wing
func (h *ExternalDownloadHandlers) SaveWingCredentials(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)
	var req struct {
		LoginID string `json:"loginId"`
		LoginPw string `json:"loginPw"`
	}
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	if req.LoginID == "" || req.LoginPw == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "loginId and loginPw are required")
	}
	if err := wing.SaveCredentials(user.UserID, req.LoginID, req.LoginPw, h.key); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"ok": true, "hasWingPw": true})
}

// SaveJikkuCredentials handles PUT /api/external-credentials/jikku
func (h *ExternalDownloadHandlers) SaveJikkuCredentials(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)
	var req struct {
		LoginID string `json:"loginId"`
		LoginPw string `json:"loginPw"`
	}
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	if req.LoginID == "" || req.LoginPw == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "loginId and loginPw are required")
	}
	if err := jikku.SaveCredentials(user.UserID, req.LoginID, req.LoginPw, h.key); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"ok": true, "hasJikkuPw": true})
}

// GetCredentialStatus handles GET /api/external-credentials/status
func (h *ExternalDownloadHandlers) GetCredentialStatus(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)

	hasWing, err := wing.HasCredentials(user.UserID)
	if err != nil {
		hasWing = false
	}
	hasJikku, err := jikku.HasCredentials(user.UserID)
	if err != nil {
		hasJikku = false
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"hasWingPw":  hasWing,
		"hasJikkuPw": hasJikku,
	})
}
