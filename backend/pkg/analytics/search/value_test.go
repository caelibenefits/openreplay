package search

import (
	"strings"
	"testing"

	"openreplay/backend/pkg/analytics/model"
)

func TestSessionValuesQuery(t *testing.T) {
	q := sessionValuesQuery(1, []uint64{11, 22})
	for _, want := range []string{"value, dollars,", "FROM caeli.session_value FINAL", "project_id = 1", "session_id IN (11,22)"} {
		if !strings.Contains(q, want) {
			t.Errorf("query missing %q:\n%s", want, q)
		}
	}
}

func TestApplySessionValues(t *testing.T) {
	ten, worth := uint8(10), float32(5.53)
	sessions := []model.Session{{SessionId: "1"}, {SessionId: "2"}, {SessionId: "3"}}
	applySessionValues(sessions, []sessionValueRow{
		{SessionId: "1", Value: &ten, Dollars: &worth, Tier: "5 intent", Ordered: 1, Settled: 0},
		{SessionId: "2", Value: nil, Tier: "internal", Settled: 1},
	})
	if i := sessions[0].Interest; i == nil || *i.Value != 10 || i.Dollars == nil || *i.Dollars != worth || !i.Ordered || !i.Provisional || i.Tier != "5 intent" {
		t.Errorf("graded session = %+v", i)
	}
	if i := sessions[1].Interest; i == nil || i.Value != nil || i.Dollars != nil || i.Provisional || i.Tier != "internal" {
		t.Errorf("not-a-visitor session = %+v", i)
	}
	if sessions[2].Interest != nil {
		t.Errorf("ungraded session = %+v, want nil", sessions[2].Interest)
	}
}
