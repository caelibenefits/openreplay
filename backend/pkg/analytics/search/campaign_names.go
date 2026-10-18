package search

// Caeli: display names for campaign IDs, edited in the dashboard
// (Preferences > Campaign names). Google Ads tags landings with the numeric
// campaign ID; the session list shows the name when one is set.

import (
	"context"
	"errors"
	"fmt"
	"strings"
)

// The table is ours, not upstream's, so it is created here rather than by the
// installer's migrations; an OpenReplay upgrade leaves it alone.
const campaignNamesDDL = `CREATE TABLE IF NOT EXISTS public.caeli_campaign_names (
	project_id  integer NOT NULL,
	campaign_id text    NOT NULL,
	name        text    NOT NULL,
	PRIMARY KEY (project_id, campaign_id)
)`

const (
	maxCampaignNames   = 500
	maxCampaignIDLen   = 200
	maxCampaignNameLen = 200
)

type CampaignName struct {
	CampaignId string `json:"campaignId"`
	Name       string `json:"name"`
}

// ErrInvalidCampaignNames marks a list the caller must fix (a 400).
var ErrInvalidCampaignNames = errors.New("invalid campaign names")

// ensureCampaignTable creates the table on first use, and tries again on the
// next call if that failed.
func (s *searchImpl) ensureCampaignTable() error {
	s.campaignTableMu.Lock()
	defer s.campaignTableMu.Unlock()
	if s.campaignTableReady {
		return nil
	}
	if err := s.pgConn.Exec(campaignNamesDDL); err != nil {
		return err
	}
	s.campaignTableReady = true
	return nil
}

// cleanCampaignNames trims each row, drops rows with an empty ID or name, and
// rejects a list that is too long or repeats an ID.
func cleanCampaignNames(in []CampaignName) ([]CampaignName, error) {
	if len(in) > maxCampaignNames {
		return nil, fmt.Errorf("%w: at most %d campaign names", ErrInvalidCampaignNames, maxCampaignNames)
	}
	out := make([]CampaignName, 0, len(in))
	seen := make(map[string]bool, len(in))
	for _, c := range in {
		id, name := strings.TrimSpace(c.CampaignId), strings.TrimSpace(c.Name)
		if id == "" || name == "" {
			continue
		}
		if len(id) > maxCampaignIDLen {
			return nil, fmt.Errorf("%w: campaign ID %q is over %d characters", ErrInvalidCampaignNames, id, maxCampaignIDLen)
		}
		if len(name) > maxCampaignNameLen {
			return nil, fmt.Errorf("%w: the name for %q is over %d characters", ErrInvalidCampaignNames, id, maxCampaignNameLen)
		}
		if seen[id] {
			return nil, fmt.Errorf("%w: campaign %q is listed twice", ErrInvalidCampaignNames, id)
		}
		seen[id] = true
		out = append(out, CampaignName{CampaignId: id, Name: name})
	}
	return out, nil
}

func (s *searchImpl) GetCampaignNames(ctx context.Context, projectId int) ([]CampaignName, error) {
	if err := s.ensureCampaignTable(); err != nil {
		return nil, err
	}
	rows, err := s.pgConn.Query(`SELECT campaign_id, name FROM public.caeli_campaign_names
		WHERE project_id = $1 ORDER BY name, campaign_id`, projectId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []CampaignName{}
	for rows.Next() {
		var c CampaignName
		if err := rows.Scan(&c.CampaignId, &c.Name); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// SetCampaignNames replaces the project's whole list and returns what it
// wrote. A list the caller must fix returns ErrInvalidCampaignNames.
func (s *searchImpl) SetCampaignNames(ctx context.Context, projectId int, names []CampaignName) ([]CampaignName, error) {
	clean, err := cleanCampaignNames(names)
	if err != nil {
		return nil, err
	}
	if err := s.ensureCampaignTable(); err != nil {
		return nil, err
	}
	tx, err := s.pgConn.Begin()
	if err != nil {
		return nil, err
	}
	if err := tx.TxExec(`DELETE FROM public.caeli_campaign_names WHERE project_id = $1`, projectId); err != nil {
		tx.TxRollback()
		return nil, err
	}
	for _, c := range clean {
		if err := tx.TxExec(`INSERT INTO public.caeli_campaign_names (project_id, campaign_id, name) VALUES ($1, $2, $3)`,
			projectId, c.CampaignId, c.Name); err != nil {
			tx.TxRollback()
			return nil, err
		}
	}
	if err := tx.TxCommit(); err != nil {
		return nil, err
	}
	return clean, nil
}

// campaignNameMap returns the names set for the given campaign IDs.
func (s *searchImpl) campaignNameMap(projectId int, ids []string) (map[string]string, error) {
	out := map[string]string{}
	if len(ids) == 0 {
		return out, nil
	}
	if err := s.ensureCampaignTable(); err != nil {
		return nil, err
	}
	rows, err := s.pgConn.Query(`SELECT campaign_id, name FROM public.caeli_campaign_names
		WHERE project_id = $1 AND campaign_id = ANY($2)`, projectId, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id, name string
		if err := rows.Scan(&id, &name); err != nil {
			return nil, err
		}
		out[id] = name
	}
	return out, rows.Err()
}
