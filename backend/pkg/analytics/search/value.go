package search

// Caeli: each listed session's interest value, the 0-30 the ad upload sends
// for a visit, written per www session by infra's cron/scripts/session-value.py
// into caeli.session_value on this ClickHouse (charts.InterestTable). A session
// with no row is not graded: not a www session, or newer than the job's last
// run (every 15 minutes).

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"openreplay/backend/pkg/analytics/charts"
	"openreplay/backend/pkg/analytics/model"
)

type sessionValueRow struct {
	SessionId string `ch:"session_id"`
	Value     *uint8 `ch:"value"`
	Tier      string `ch:"tier"`
	Ordered   uint8  `ch:"ordered"`
	Settled   uint8  `ch:"settled"`
}

func sessionValuesQuery(projectId int, ids []uint64) string {
	list := make([]string, len(ids))
	for i, id := range ids {
		list[i] = strconv.FormatUint(id, 10)
	}
	return fmt.Sprintf(`SELECT toString(session_id) AS session_id, value, tier, ordered, settled
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
