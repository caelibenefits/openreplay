package search

import (
	"strings"
	"testing"

	"openreplay/backend/pkg/analytics/model"
)

func TestClassifySource(t *testing.T) {
	cases := []struct {
		name, url, source, campaign string
	}{
		{"google ad, campaign from utm",
			"https://www.getcaeli.com/shop/?utm_campaign=24356000612&utm_term=massage&gclid=Cj0abc",
			SourceGoogleAds, "24356000612"},
		{"google ad from an iPhone app carries wbraid, not gclid",
			"https://www.getcaeli.com/?wbraid=CkQabc&gad_campaignid=24342102153",
			SourceGoogleAds, "24342102153"},
		{"gbraid alone is a google ad",
			"https://www.getcaeli.com/?gbraid=0AAAAA",
			SourceGoogleAds, ""},
		{"chatgpt paid link",
			"https://www.getcaeli.com/shop/x/?utm_source=chatgpt&utm_medium=cpc&utm_campaign=shop_focus_list",
			SourceChatGPTAds, "shop_focus_list"},
		{"chatgpt organic answer link is not paid",
			"https://www.getcaeli.com/shop/x/?utm_source=chatgpt.com",
			SourceChatGPT, ""},
		{"other tagged campaign",
			"https://www.getcaeli.com/learn/x/?utm_source=newsletter&utm_medium=email&utm_campaign=oct",
			"newsletter / email", "oct"},
		{"medium only",
			"https://www.getcaeli.com/?utm_medium=social",
			"social", ""},
		{"campaign only",
			"https://www.getcaeli.com/?utm_campaign=launch",
			"Campaign", "launch"},
		{"no tags",
			"https://www.getcaeli.com/shop/",
			SourceUntagged, ""},
		{"pay page on our site",
			"https://www.getcaeli.com/pay/?o=1",
			SourceUntagged, ""},
		// The extension panel records ON merchant pages; a merchant's own
		// Google ad must not read as ours.
		{"merchant page with its own gclid",
			"https://www.coway-usa.com/air?gclid=Cj0xyz",
			"", ""},
		{"extension popup",
			"chrome-extension://abc/popup.html",
			"", ""},
		{"lookalike host",
			"https://getcaeli.com.evil.example/?gclid=x",
			"", ""},
		{"unparseable", "%zz", "", ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			src, camp := classifySource(c.url)
			if src != c.source || camp != c.campaign {
				t.Fatalf("classifySource(%q) = (%q, %q), want (%q, %q)", c.url, src, camp, c.source, c.campaign)
			}
		})
	}
}

func TestEntryURLsQuery(t *testing.T) {
	q := entryURLsQuery(1, []uint64{11, 22}, 100, 200)
	for _, want := range []string{
		"project_id = 1",
		`"$event_name" = 'LOCATION'`,
		"session_id IN (11,22)",
		"BETWEEN toDateTime(100) AND toDateTime(200)",
		`argMin("$current_url", created_at)`,
	} {
		if !strings.Contains(q, want) {
			t.Errorf("query missing %q:\n%s", want, q)
		}
	}
}

func TestApplyCampaignNames(t *testing.T) {
	sessions := []model.Session{
		{SessionId: "1", Source: SourceGoogleAds, Campaign: "24356000612"},
		{SessionId: "2", Source: SourceGoogleAds, Campaign: "999"},
		{SessionId: "3", Source: SourceUntagged},
	}
	applyCampaignNames(sessions, map[string]string{"24356000612": "Product Search"})
	if sessions[0].Campaign != "Product Search" || sessions[0].CampaignId != "24356000612" {
		t.Errorf("named campaign = (%q, %q)", sessions[0].Campaign, sessions[0].CampaignId)
	}
	if sessions[1].Campaign != "999" || sessions[1].CampaignId != "" {
		t.Errorf("unnamed campaign = (%q, %q), want the ID unchanged", sessions[1].Campaign, sessions[1].CampaignId)
	}
	if sessions[2].Campaign != "" || sessions[2].CampaignId != "" {
		t.Errorf("no campaign = (%q, %q)", sessions[2].Campaign, sessions[2].CampaignId)
	}
}

func TestCleanCampaignNames(t *testing.T) {
	got, err := cleanCampaignNames([]CampaignName{
		{" 24356000612 ", " Product Search "},
		{"", "no id"},
		{"123", ""},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0] != (CampaignName{"24356000612", "Product Search"}) {
		t.Errorf("got %+v, want one trimmed row", got)
	}
	if _, err := cleanCampaignNames([]CampaignName{{"1", "a"}, {" 1", "b"}}); err == nil {
		t.Error("a repeated ID was accepted")
	}
	if _, err := cleanCampaignNames([]CampaignName{{"1", strings.Repeat("x", maxCampaignNameLen+1)}}); err == nil {
		t.Error("an over-long name was accepted")
	}
	if _, err := cleanCampaignNames(make([]CampaignName, maxCampaignNames+1)); err == nil {
		t.Error("an over-long list was accepted")
	}
}
