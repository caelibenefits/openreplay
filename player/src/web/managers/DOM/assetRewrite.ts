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

/** The proxied URL when `url` is on the asset host, else null. */
export function proxiedAssetUrl(url: string): string | null {
  if (!rule || typeof url !== 'string' || !url.startsWith(rule.from)) return null;
  return rule.to + url.slice(rule.from.length);
}

/**
 * A stylesheet COPY on the asset host carries absolute asset-host url()s in
 * its body (fonts), which no attribute rewrite reaches: the browser fetches
 * them itself. Fetch the CSS through the proxy, rewrite its body, and return it
 * as a data: URL the replay frame can load (a blob: URL would be bound to this
 * origin, and the replay frame is sandboxed). Null when not applicable.
 */
/** A stylesheet copy on the asset host (only while a proxy is configured). */
export function isAssetStylesheet(url: string): boolean {
  if (!proxiedAssetUrl(url)) return false;
  try {
    return /\.css(\.\d+)?$/i.test(decodeURIComponent(url));
  } catch {
    return false;
  }
}

export async function inlineAssetStylesheet(url: string): Promise<string | null> {
  const proxied = proxiedAssetUrl(url);
  if (!proxied || !isAssetStylesheet(url)) return null;
  try {
    const res = await fetch(proxied);
    if (!res.ok) return null;
    const css = rewriteAssetUrls(await res.text());
    return `data:text/css;charset=utf-8,${encodeURIComponent(css)}`;
  } catch {
    return null;
  }
}
