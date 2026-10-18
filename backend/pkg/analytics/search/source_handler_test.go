package search

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"

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

	if w := call(""); w.Code != http.StatusBadRequest || fake.calls != 0 {
		t.Fatalf("no startTs: status %d, calls %d; want 400 and no lookup", w.Code, fake.calls)
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
