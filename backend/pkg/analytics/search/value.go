package search

// Caeli: each listed session's value, written per www session by infra's
// ad-conversion-upload.py (replay_value.py) into caeli.session_value on this
// ClickHouse (charts.InterestTable). Dollars is the projected value, the
// visit's expected order value that the ad upload sends (SCRUM-1956); Value is
// the older points, kept for the not-a-visitor test. A session with no row is
// not graded: not a www session, or newer than the job's last run (hourly).

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"openreplay/backend/pkg/analytics/charts"
	"openreplay/backend/pkg/analytics/model"
)

// valuesTimeout bounds the value lookup, so a slow table never holds the list
// or the replay header; past it the sessions go without a value.
const valuesTimeout = 3 * time.Second

type sessionValueRow struct {
	SessionId string `ch:"session_id"`
	Value     *uint8   `ch:"value"`
	Dollars   *float32 `ch:"dollars"`
	Tier      string `ch:"tier"`
	Ordered   uint8  `ch:"ordered"`
	Settled   uint8  `ch:"settled"`
}

func sessionValuesQuery(projectId int, ids []uint64) string {
	list := make([]string, len(ids))
	for i, id := range ids {
		list[i] = strconv.FormatUint(id, 10)
	}
	return fmt.Sprintf(`SELECT toString(session_id) AS session_id, value, dollars, tier, ordered, settled
FROM %s FINAL
WHERE project_id = %d
  AND session_id IN (%s)`, charts.InterestTable, projectId, strings.Join(list, ","))
}

// applySessionValues sets Interest on each session that has a row. A NULL
// value is "not a visitor" (the team, a crawler), which the list shows as such.
func applySessionValues(sessions []model.Session, rows []sessionValueRow) {
	byId := make(map[string]sessionValueRow, len(rows))
	for _, r := range rows {
		byId[r.SessionId] = r
	}
	for i := range sessions {
		r, ok := byId[sessions[i].SessionId]
		if !ok {
			continue
		}
		sessions[i].Interest = &model.SessionInterest{
			Value:       r.Value,
			Dollars:     r.Dollars,
			Tier:        r.Tier,
			Ordered:     r.Ordered == 1,
			Provisional: r.Settled == 0,
		}
	}
}

// attachValues sets Interest on the sessions. A failed lookup is logged and
// leaves it unset: the list still loads.
func (s *searchImpl) attachValues(ctx context.Context, projectId int, ids []uint64, sessions []model.Session) {
	var rows []sessionValueRow
	if err := s.chConn.Select(ctx, &rows, sessionValuesQuery(projectId, ids)); err != nil {
		s.Logger.Warn(ctx, "Error loading session values: %s", err)
		return
	}
	applySessionValues(sessions, rows)
}
