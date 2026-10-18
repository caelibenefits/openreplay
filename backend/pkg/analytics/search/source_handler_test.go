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
	calls              int
	projectId          int
	sessionId, startTs uint64
}

func (f *fakeSourceSearch) GetSessionSource(_ context.Context, projectId int, sessionId, startTs uint64) SessionSource {
	f.calls++
	f.projectId, f.sessionId, f.startTs = projectId, sessionId, startTs
	return SessionSource{Source: SourceGoogleAds, Campaign: "Product Search", CampaignId: "24356000612"}
}

func TestGetSessionSourceHandler(t *testing.T) {
	fake := &fakeSourceSearch{}
	h := &handlersImpl{log: logger.New(), responser: api.NewResponser(web.New("test")), search: fake}
	call := func(query string) *httptest.ResponseRecorder {
		r := httptest.NewRequest("GET", "/v2/api/1/sessions/4065014380368490792/source"+query, nil)
		r = mux.SetURLVars(r, map[string]string{"projectId": "1", "sessionId": "4065014380368490792"})
		w := httptest.NewRecorder()
		h.getSessionSource(w, r)
		return w
	}

	for _, q := range []string{"", "?startTs=abc", "?startTs=0"} {
		if w := call(q); w.Code != http.StatusBadRequest || fake.calls != 0 {
			t.Fatalf("%q: status %d, calls %d; want 400 and no lookup", q, w.Code, fake.calls)
		}
	}

	w := call("?startTs=1760750000000")
	if w.Code != http.StatusOK {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	if fake.projectId != 1 || fake.sessionId != 4065014380368490792 || fake.startTs != 1760750000000 {
		t.Fatalf("lookup got project %d session %d start %d", fake.projectId, fake.sessionId, fake.startTs)
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
	router.Get().ServeHTTP(w, httptest.NewRequest("GET", "/1/sessions/4065014380368490792/source?startTs=1760750000000", nil))
	if w.Code != http.StatusOK || fake.calls != 1 || fake.sessionId != 4065014380368490792 || fake.projectId != 1 {
		t.Fatalf("status %d, calls %d, project %d, session %d", w.Code, fake.calls, fake.projectId, fake.sessionId)
	}
	w = httptest.NewRecorder()
	router.Get().ServeHTTP(w, httptest.NewRequest("POST", "/1/sessions/4065014380368490792/source?startTs=1760750000000", nil))
	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("POST: status %d, want 405", w.Code)
	}
}
