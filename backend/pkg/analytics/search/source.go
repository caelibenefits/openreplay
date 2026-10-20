package search

// Caeli: where each listed session came from, read off its entry URL.
//
// The session's own referrer and utm_* columns can't be used: the db service
// overwrites the referrer on every page (so it ends as our own site) and the
// ClickHouse session row is written from a copy that misses those updates.
// The first LOCATION event's URL is always recorded, so the source is derived
// from it at read time and works for every session already stored.

import (
	"context"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"

	"openreplay/backend/pkg/analytics/model"
	"openreplay/backend/pkg/db/postgres"
)

const (
	SourceGoogleAds  = "Google Ads"
	SourceChatGPTAds = "ChatGPT Ads"
	SourceChatGPT    = "ChatGPT"
	SourceUntagged   = "Untagged"
)

// entryWindow bounds the events scan after the newest listed session's start;
// a session's first page view lands within seconds of its start.
const entryWindow = 6 * time.Hour

// classifySource returns the source and campaign for a session's entry URL.
// Only landings on our own site are classified: the project also records the
// extension panel ON merchant pages, whose URL can carry the merchant's own
// gclid. Anything else returns "", which the list shows as nothing.
func classifySource(entryURL string) (source, campaign string) {
	u, err := url.Parse(entryURL)
	if err != nil {
		return "", ""
	}
	host := strings.ToLower(u.Hostname())
	if host != "getcaeli.com" && !strings.HasSuffix(host, ".getcaeli.com") {
		return "", ""
	}
	q := u.Query()
	utmSource := strings.ToLower(q.Get("utm_source"))
	utmMedium := strings.ToLower(q.Get("utm_medium"))
	utmCampaign := q.Get("utm_campaign")

	switch {
	case q.Has("gclid") || q.Has("gbraid") || q.Has("wbraid"):
		if utmCampaign == "" {
			utmCampaign = q.Get("gad_campaignid")
		}
		return SourceGoogleAds, utmCampaign
	// Whole values: ChatGPT tags its paid links utm_source=chatgpt and its
	// organic answer links utm_source=chatgpt.com.
	case utmSource == "chatgpt":
		return SourceChatGPTAds, utmCampaign
	case utmSource == "chatgpt.com":
		return SourceChatGPT, ""
	case utmSource != "" || utmMedium != "":
		label := utmSource
		if label == "" {
			label = utmMedium
		} else if utmMedium != "" {
			label += " / " + utmMedium
		}
		return label, utmCampaign
	case utmCampaign != "":
		return "Campaign", utmCampaign
	}
	return SourceUntagged, ""
}

// entryURLsQuery returns the first LOCATION URL of each given session.
func entryURLsQuery(projectId int, ids []uint64, fromSec, toSec int64) string {
	list := make([]string, len(ids))
	for i, id := range ids {
		list[i] = strconv.FormatUint(id, 10)
	}
	return fmt.Sprintf(`SELECT toString(session_id) AS session_id,
	argMin("$current_url", created_at) AS url
FROM product_analytics.events
WHERE project_id = %d
  AND "$event_name" = 'LOCATION'
  AND created_at BETWEEN toDateTime(%d) AND toDateTime(%d)
  AND session_id IN (%s)
GROUP BY session_id`, projectId, fromSec, toSec, strings.Join(list, ","))
}

type entryURLRow struct {
	SessionId string `ch:"session_id"`
	URL       string `ch:"url"`
}

// attachSources sets Source and Campaign on each session. A failed lookup is
// logged and leaves them empty: the list still loads without a source.
func (s *searchImpl) attachSources(ctx context.Context, projectId int, sessions []model.Session) {
	if len(sessions) == 0 {
		return
	}
	ids := make([]uint64, 0, len(sessions))
	var minTs, maxTs uint64
	for _, sess := range sessions {
		id, err := strconv.ParseUint(sess.SessionId, 10, 64)
		if err != nil {
			continue
		}
		ids = append(ids, id)
		if minTs == 0 || sess.StartTs < minTs {
			minTs = sess.StartTs
		}
		if sess.StartTs > maxTs {
			maxTs = sess.StartTs
		}
	}
	if len(ids) == 0 {
		return
	}
	s.attachValues(ctx, projectId, ids, sessions)
	fromSec := int64(minTs/1000) - 60
	toSec := int64(maxTs/1000) + int64(entryWindow/time.Second)

	var rows []entryURLRow
	if err := s.chConn.Select(ctx, &rows, entryURLsQuery(projectId, ids, fromSec, toSec)); err != nil {
		s.Logger.Warn(ctx, "Error loading session entry URLs: %s", err)
		return
	}
	entry := make(map[string]string, len(rows))
	for _, r := range rows {
		entry[r.SessionId] = r.URL
	}
	var campaigns []string
	for i := range sessions {
		if u, ok := entry[sessions[i].SessionId]; ok {
			sessions[i].Source, sessions[i].Campaign = classifySource(u)
			if sessions[i].Campaign != "" {
				campaigns = append(campaigns, sessions[i].Campaign)
			}
		}
	}
	names, err := s.campaignNameMap(projectId, campaigns)
	if err != nil {
		s.Logger.Warn(ctx, "Error loading campaign names: %s", err)
		return
	}
	applyCampaignNames(sessions, names)
}

// applyCampaignNames shows a campaign's name in place of its ID, keeping the
// ID in CampaignId.
func applyCampaignNames(sessions []model.Session, names map[string]string) {
	for i := range sessions {
		if name, ok := names[sessions[i].Campaign]; ok {
			sessions[i].CampaignId = sessions[i].Campaign
			sessions[i].Campaign = name
		}
	}
}

// SessionSource is one session's source, for the replay screen's header.
type SessionSource struct {
	Source     string `json:"source,omitempty"`
	Campaign   string `json:"campaign,omitempty"`
	CampaignId string `json:"campaignId,omitempty"`
	// Caeli: the interest value (search/value.go); nil when not graded.
	Interest *model.SessionInterest `json:"interest,omitempty"`
}

// GetSessionSource runs the session list's lookup for a single session. The
// start comes from Postgres, which has the session from its first request;
// found is false when the project has no such session. Like the list, a
// failed source lookup is logged and returns an empty source.
func (s *searchImpl) GetSessionSource(ctx context.Context, projectId int, sessionId uint64) (SessionSource, bool, error) {
	var startTs int64
	err := s.pgConn.QueryRow(`SELECT start_ts FROM public.sessions WHERE session_id = $1 AND project_id = $2`,
		sessionId, projectId).Scan(&startTs)
	if postgres.IsNoRowsErr(err) {
		return SessionSource{}, false, nil
	}
	if err != nil {
		return SessionSource{}, false, err
	}
	sessions := []model.Session{{SessionId: strconv.FormatUint(sessionId, 10), StartTs: uint64(startTs)}}
	s.attachSources(ctx, projectId, sessions)
	return SessionSource{Source: sessions[0].Source, Campaign: sessions[0].Campaign, CampaignId: sessions[0].CampaignId,
		Interest: sessions[0].Interest}, true, nil
}
