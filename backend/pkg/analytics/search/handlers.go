package search

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	config "openreplay/backend/internal/config/api"
	"openreplay/backend/pkg/analytics/model"
	"openreplay/backend/pkg/logger"
	"openreplay/backend/pkg/server/api"
	"openreplay/backend/pkg/server/user"

	"github.com/go-playground/validator/v10"
)

type handlersImpl struct {
	log           logger.Logger
	responser     api.Responser
	jsonSizeLimit int64
	search        Search
	validator     *validator.Validate
}

func (e *handlersImpl) GetAll() []*api.Description {
	return []*api.Description{
		{"/{projectId}/sessions/search", "POST", e.getSessions, []string{api.SESSION_REPLAY}, api.DoNotTrack},
		{"/{projectId}/sessions/search/ids", "POST", e.getSessionIDs, []string{api.SESSION_REPLAY}, api.DoNotTrack},
		{"/{projectId}/sessions/campaign-names", "GET", e.getCampaignNames, []string{api.SESSION_REPLAY}, api.DoNotTrack},
		{"/{projectId}/sessions/campaign-names", "PUT", e.setCampaignNames, []string{api.SESSION_REPLAY}, "set_campaign_names"},
	}
}

func NewHandlers(log logger.Logger, cfg *config.Config, responser api.Responser, search Search, validator *validator.Validate) (api.Handlers, error) {
	return &handlersImpl{
		log:           log,
		responser:     responser,
		jsonSizeLimit: cfg.JsonSizeLimit,
		search:        search,
		validator:     validator,
	}, nil
}

func (e *handlersImpl) getSessions(w http.ResponseWriter, r *http.Request) {
	startTime := time.Now()
	bodySize := 0

	bodyBytes, err := api.ReadBody(e.log, w, r, e.jsonSizeLimit)
	if err != nil {
		e.responser.ResponseWithError(e.log, r.Context(), w, http.StatusRequestEntityTooLarge, err, startTime, r.URL.Path, bodySize)
		return
	}
	bodySize = len(bodyBytes)

	req := &model.SessionsSearchRequest{}
	if err := json.Unmarshal(bodyBytes, req); err != nil {
		e.responser.ResponseWithError(e.log, r.Context(), w, http.StatusBadRequest, err, startTime, r.URL.Path, bodySize)
		return
	}

	if req.Bookmarked {
		if req.Page == 0 {
			req.Page = 1
		}
		if req.Limit == 0 {
			req.Limit = 10
		}
		if err = e.validator.Var(req.Page, "required,min=1"); err != nil {
			e.responser.ResponseWithError(e.log, r.Context(), w, http.StatusBadRequest, err, startTime, r.URL.Path, bodySize)
			return
		}
		if err = e.validator.Var(req.Limit, "required,min=1,max=200"); err != nil {
			e.responser.ResponseWithError(e.log, r.Context(), w, http.StatusBadRequest, err, startTime, r.URL.Path, bodySize)
			return
		}
	} else {
		if err = e.validator.Struct(req); err != nil {
			e.responser.ResponseWithError(e.log, r.Context(), w, http.StatusBadRequest, err, startTime, r.URL.Path, bodySize)
			return
		}
	}

	projectID, err := api.GetPathParam(r, "projectId", api.ParseInt)
	if err != nil {
		e.responser.ResponseWithError(e.log, r.Context(), w, http.StatusBadRequest, err, startTime, r.URL.Path, bodySize)
		return
	}

	currentUser := r.Context().Value("userData").(*user.User)

	var resp interface{}
	if req.Bookmarked {
		resp, err = e.search.GetBookmarkedSessions(r.Context(), projectID, currentUser.ID, req)
	} else {
		resp, err = e.search.GetAll(r.Context(), projectID, currentUser.ID, req)
	}

	if err != nil {
		e.responser.ResponseWithError(e.log, r.Context(), w, http.StatusInternalServerError, err, startTime, r.URL.Path, bodySize)
		return
	}

	e.responser.ResponseWithJSON(e.log, r.Context(), w, map[string]interface{}{"data": resp}, startTime, r.URL.Path, bodySize)
}

func (e *handlersImpl) getSessionIDs(w http.ResponseWriter, r *http.Request) {
	startTime := time.Now()
	bodySize := 0

	bodyBytes, err := api.ReadBody(e.log, w, r, e.jsonSizeLimit)
	if err != nil {
		e.responser.ResponseWithError(e.log, r.Context(), w, http.StatusRequestEntityTooLarge, err, startTime, r.URL.Path, bodySize)
		return
	}
	bodySize = len(bodyBytes)

	req := &model.SessionsSearchRequest{}
	if err := json.Unmarshal(bodyBytes, req); err != nil {
		e.responser.ResponseWithError(e.log, r.Context(), w, http.StatusBadRequest, err, startTime, r.URL.Path, bodySize)
		return
	}

	if err = e.validator.Struct(req); err != nil {
		e.responser.ResponseWithError(e.log, r.Context(), w, http.StatusBadRequest, err, startTime, r.URL.Path, bodySize)
		return
	}

	projectID, err := api.GetPathParam(r, "projectId", api.ParseInt)
	if err != nil {
		e.responser.ResponseWithError(e.log, r.Context(), w, http.StatusBadRequest, err, startTime, r.URL.Path, bodySize)
		return
	}

	currentUser := r.Context().Value("userData").(*user.User)
	resp, err := e.search.GetSessionIds(r.Context(), projectID, currentUser.ID, req)
	if err != nil {
		e.responser.ResponseWithError(e.log, r.Context(), w, http.StatusInternalServerError, err, startTime, r.URL.Path, bodySize)
		return
	}

	e.responser.ResponseWithJSON(e.log, r.Context(), w, map[string]interface{}{"data": resp}, startTime, r.URL.Path, bodySize)
}

// Caeli: campaign display names (see campaign_names.go).
func (e *handlersImpl) getCampaignNames(w http.ResponseWriter, r *http.Request) {
	startTime := time.Now()
	projectID, err := api.GetPathParam(r, "projectId", api.ParseInt)
	if err != nil {
		e.responser.ResponseWithError(e.log, r.Context(), w, http.StatusBadRequest, err, startTime, r.URL.Path, 0)
		return
	}
	names, err := e.search.GetCampaignNames(r.Context(), projectID)
	if err != nil {
		e.responser.ResponseWithError(e.log, r.Context(), w, http.StatusInternalServerError, err, startTime, r.URL.Path, 0)
		return
	}
	e.responser.ResponseWithJSON(e.log, r.Context(), w, map[string]interface{}{"data": names}, startTime, r.URL.Path, 0)
}

func (e *handlersImpl) setCampaignNames(w http.ResponseWriter, r *http.Request) {
	startTime := time.Now()
	bodyBytes, err := api.ReadBody(e.log, w, r, e.jsonSizeLimit)
	if err != nil {
		e.responser.ResponseWithError(e.log, r.Context(), w, http.StatusRequestEntityTooLarge, err, startTime, r.URL.Path, 0)
		return
	}
	bodySize := len(bodyBytes)
	projectID, err := api.GetPathParam(r, "projectId", api.ParseInt)
	if err != nil {
		e.responser.ResponseWithError(e.log, r.Context(), w, http.StatusBadRequest, err, startTime, r.URL.Path, bodySize)
		return
	}
	var req struct {
		Names []CampaignName `json:"names"`
	}
	if err := json.Unmarshal(bodyBytes, &req); err != nil {
		e.responser.ResponseWithError(e.log, r.Context(), w, http.StatusBadRequest, err, startTime, r.URL.Path, bodySize)
		return
	}
	names, err := e.search.SetCampaignNames(r.Context(), projectID, req.Names)
	if err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, ErrInvalidCampaignNames) {
			status = http.StatusBadRequest
		}
		e.responser.ResponseWithError(e.log, r.Context(), w, status, err, startTime, r.URL.Path, bodySize)
		return
	}
	e.responser.ResponseWithJSON(e.log, r.Context(), w, map[string]interface{}{"data": names}, startTime, r.URL.Path, bodySize)
}
