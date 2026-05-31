package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/rocketgrowth/backend/internal/aianalyze"
	"github.com/rocketgrowth/backend/internal/middleware"
)

type AIAnalyzeHandlers struct {
	svc *aianalyze.Service
}

func NewAIAnalyzeHandlers(apiKey string) *AIAnalyzeHandlers {
	return &AIAnalyzeHandlers{
		svc: &aianalyze.Service{APIKey: apiKey},
	}
}

// Analyze handles POST /api/ai/analyze
func (h *AIAnalyzeHandlers) Analyze(c echo.Context) error {
	user := c.Get("user").(*middleware.UserContext)

	var req aianalyze.AnalyzeRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	if req.Question == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "question is required")
	}
	if req.Source == "" || req.ReportType == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "source and reportType are required")
	}

	resp, err := h.svc.Analyze(c.Request().Context(), user.UserID, req)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, resp)
}
