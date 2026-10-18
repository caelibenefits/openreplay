package search

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"

	"openreplay/backend/internal/config/common"
	"openreplay/backend/pkg/logger"
	"openreplay/backend/pkg/metrics/web"
	"openreplay/backend/pkg/server/api"
)

type fakeSourceSearch struct {
	Search
	calls     int
	projectId int
	sessionId uint64
}

// knownSession is the only session the fake finds.
const knownSession = 4065014380368490792

func (f *fakeSourceSearch) GetSessionSource(_ context.Context, projectId int, sessionId uint64) (SessionSource, bool, error) {
	f.calls++
	f.projectId, f.sessionId = projectId, sessionId
	if sessionId != knownSession {
		return SessionSource{}, false, nil
	}
	return SessionSource{Source: SourceGoogleAds, Campaign: "Product Search", CampaignId: "24356000612"}, true, nil
}

func TestGetSessionSourceHandler(t *testing.T) {
	fake := &fakeSourceSearch{}
	h := &handlersImpl{log: logger.New(), responser: api.NewResponser(web.New("test")), search: fake}
	call := func(sessionID string) *httptest.ResponseRecorder {
		r := httptest.NewRequest("GET", "/1/sessions/"+sessionID+"/source", nil)
		r = mux.SetURLVars(r, map[string]string{"projectId": "1", "sessionId": sessionID})
		w := httptest.NewRecorder()
		h.getSessionSource(w, r)
		return w
	}

	if w := call("abc"); w.Code != http.StatusBadRequest || fake.calls != 0 {
		t.Fatalf("bad id: status %d, calls %d; want 400 and no lookup", w.Code, fake.calls)
	}
	if w := call("123"); w.Code != http.StatusNotFound {
		t.Fatalf("unknown session: status %d, want 404", w.Code)
	}

	w := call("4065014380368490792")
	if w.Code != http.StatusOK {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	if fake.projectId != 1 || fake.sessionId != knownSession {
		t.Fatalf("lookup got project %d session %d", fake.projectId, fake.sessionId)
	}
	var body struct {
		Data SessionSource `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.Data != (SessionSource{Source: SourceGoogleAds, Campaign: "Product Search", CampaignId: "24356000612"}) {
		t.Fatalf("data = %+v", body.Data)
	}
}

// The route as registered: path, method and param names reach the handler.
func TestGetSessionSourceRoute(t *testing.T) {
	fake := &fakeSourceSearch{}
	h := &handlersImpl{log: logger.New(), responser: api.NewResponser(web.New("test_route")), search: fake}
	router, err := api.NewRouter(logger.New(), &common.HTTP{}, api.NoPrefix, []api.Handlers{h}, nil)
	if err != nil {
		t.Fatal(err)
	}
	w := httptest.NewRecorder()
	router.Get().ServeHTTP(w, httptest.NewRequest("GET", "/1/sessions/4065014380368490792/source", nil))
	if w.Code != http.StatusOK || fake.calls != 1 || fake.sessionId != 4065014380368490792 || fake.projectId != 1 {
		t.Fatalf("status %d, calls %d, project %d, session %d", w.Code, fake.calls, fake.projectId, fake.sessionId)
	}
	w = httptest.NewRecorder()
	router.Get().ServeHTTP(w, httptest.NewRequest("POST", "/1/sessions/4065014380368490792/source", nil))
	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("POST: status %d, want 405", w.Code)
	}
}
