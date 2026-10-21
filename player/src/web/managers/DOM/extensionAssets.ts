/**
 * Caeli: the extension's popup and panel pages load their stylesheets, fonts
 * and images from the extension itself (safari-web-extension://<id>/assets/...,
 * chrome-extension://<id>/assets/...), which no replay viewer can open, so
 * those sessions replayed unstyled. The build names each file by its content
 * hash, so a name is the same bytes in every build that has it: the dashboard
 * serves copies of the builds' assets/ (see the Confluence runbook), and the
 * player loads the copy instead.
 */
const EXTENSION_ASSET =
  /^(?:safari-web-extension|chrome-extension|moz-extension):\/\/[^/]+\/assets\/([A-Za-z0-9_-][A-Za-z0-9._-]*)$/i;

let base: string | null = null;

/** Where the copies are served, e.g. `${origin}/ext-assets/`; null turns it off. */
export function configureExtensionAssets(prefix: string | null): void {
  base = prefix;
}

/** The served copy of an extension asset URL, else null. */
export function extensionAssetUrl(url: string): string | null {
  if (!base || typeof url !== 'string') return null;
  const match = EXTENSION_ASSET.exec(url.split(/[?#]/)[0]);
  return match ? base + match[1] : null;
}
