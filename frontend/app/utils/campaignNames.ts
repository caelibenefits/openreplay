// Caeli: Preferences > Campaign Names (components/Client/CampaignNames.tsx).

/** IDs listed more than once, compared without surrounding spaces. */
export function duplicateIds(rows: { campaignId: string }[]): string[] {
  const seen = new Set<string>();
  const dups = new Set<string>();
  rows.forEach((r) => {
    const id = r.campaignId.trim();
    if (!id) return;
    if (seen.has(id)) dups.add(id);
    seen.add(id);
  });
  return [...dups];
}
