/**
 * Caeli: recordings reference page assets as copies on OpenReplay's asset
 * host (https://assets.openreplay.com/...). That host only allows
 * app.openreplay.com, so a dashboard on another origin gets fonts blocked by
 * CORS. A host may register a same-origin proxy for it; every URL the player
 * writes into the replay DOM then goes through it.
 */
let rule: { from: string; to: string } | null = null;

export function configureAssetRewrite(from: string | null, to?: string): void {
  rule = from && to ? { from, to } : null;
}

export function rewriteAssetUrls(value: string): string {
  if (!rule || typeof value !== 'string' || !value.includes(rule.from)) return value;
  return value.split(rule.from).join(rule.to);
}
