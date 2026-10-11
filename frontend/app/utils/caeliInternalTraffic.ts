/**
 * Caeli: which sessions are our own traffic, by the client IP the ingest
 * recorded (the "ip" metadata, set server-side by our http service).
 *
 * THE LIST IS slack-app's `INTERNAL_TEST_IPS` (its .env.prod), the same rule
 * that marks ClickHouse events is_test. Keep the two in step: when an address
 * is added there, add it here. Entries are single IPs or CIDRs; a CIDR must be
 * octet-aligned (/8, /16, /24, /32) so it becomes a plain prefix.
 */
export const INTERNAL_IPS = [
  '67.160.35.32',
  '76.231.26.97',
  '75.83.96.97',
  '24.85.209.0',
  '184.169.160.244',
  '66.249.0.0/16',
] as const;

/** The API accepts at most 10 values per filter (a 400 otherwise). */
const MAX_FILTER_VALUES = 10;

export interface IpMatchers {
  /** Addresses compared whole. */
  exact: string[];
  /** Prefixes from octet-aligned CIDRs, each ending in "." */
  prefixes: string[];
}

/** Split the list into whole addresses and CIDR prefixes. Throws on a CIDR it cannot express as a prefix. */
export function ipMatchers(entries: readonly string[]): IpMatchers {
  const exact: string[] = [];
  const prefixes: string[] = [];
  for (const raw of entries) {
    const entry = raw.trim();
    if (!entry) continue;
    const [addr, bitsText] = entry.split('/');
    if (bitsText === undefined) {
      exact.push(addr);
      continue;
    }
    const bits = Number(bitsText);
    const octets = addr.split('.');
    if (octets.length !== 4 || ![8, 16, 24, 32].includes(bits)) {
      throw new Error(`INTERNAL_IPS: ${entry} is not an octet-aligned IPv4 CIDR`);
    }
    if (bits === 32) exact.push(addr);
    else prefixes.push(`${octets.slice(0, bits / 8).join('.')}.`);
  }
  return { exact, prefixes };
}

function chunk<T>(values: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < values.length; i += MAX_FILTER_VALUES) out.push(values.slice(i, i + MAX_FILTER_VALUES));
  return out;
}

/**
 * Search filters that leave out internal sessions, on the column that holds
 * "ip" (metadata_N). The backend keeps sessions with no ip at all (recorded
 * before the key existed) for these negative operators.
 */
export function excludeInternalFilters(column: string, entries: readonly string[] = INTERNAL_IPS): any[] {
  const { exact, prefixes } = ipMatchers(entries);
  const base = {
    name: column,
    dataType: 'string',
    isEvent: false,
    autoCaptured: true,
    propertyOrder: 'and',
    filters: [],
  };
  return [
    ...chunk(exact).map((value) => ({ ...base, operator: 'isNot', value })),
    ...chunk(prefixes).map((value) => ({ ...base, operator: 'notStartsWith', value })),
  ];
}

/** The metadata column the project declared `key` in, from the filter catalog. */
export function metadataColumn(catalog: { name: string; displayName?: string }[], key: string): string | null {
  const f = catalog.find((c) => c.displayName === key && /^metadata_(?:[1-9]|10)$/.test(c.name));
  return f ? f.name : null;
}

/** The metadata column the project declared "ip" in. */
export function ipColumn(catalog: { name: string; displayName?: string }[]): string | null {
  return metadataColumn(catalog, 'ip');
}

/**
 * Leaves out sessions www tagged as automated: its `bot` metadata is
 * "webdriver" or "ua" for a crawler (www lib/openreplay.ts crawlerSignal), and
 * unset for a visitor. isUndefined matches NULL or empty, so every session
 * without the tag, including all recorded before it existed, stays.
 */
export function excludeTaggedBotsFilter(column: string): any {
  return {
    name: column,
    operator: 'isUndefined',
    value: [],
    dataType: 'string',
    isEvent: false,
    autoCaptured: true,
    propertyOrder: 'and',
    filters: [],
  };
}
