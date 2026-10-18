// Caeli: how a session's source reads, in the session list and the replay
// header. The api works out source and campaign (search/source.go).

export interface SourceParts {
  source?: string;
  campaign?: string;
  campaignId?: string;
}

export const sourceLabel = ({ source, campaign }: SourceParts) =>
  campaign ? `${source} · ${campaign}` : source || '';

// The full text, for a hover: the campaign ID follows a campaign's name.
export const sourceTitle = ({ source, campaign, campaignId }: SourceParts) =>
  campaign
    ? `${source} · campaign ${campaignId ? `${campaign} (${campaignId})` : campaign}`
    : source || '';
