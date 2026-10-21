// Caeli: the session list shows a session's metadata as one row of value
// chips under the tile. Chips that repeat what the tile already says, or a
// value nearly every session has, are left out.

export interface MetaChip {
  label: string;
  value: string;
}

// The common case for each key: shown only when a session differs from it.
const DEFAULT_VALUES: Record<string, string> = {
  platform: 'web',
  surface: 'www',
};

/** The chips worth showing: not the default platform/surface, and not a
 *  visitor_id that is the session's own (already the tile's title). */
export function visibleMeta(
  list: MetaChip[],
  ownIds: Array<string | null | undefined>,
): MetaChip[] {
  const own = new Set(ownIds.filter(Boolean).map((v) => String(v)));
  return list.filter(({ label, value }) => {
    const v = `${value}`;
    if (DEFAULT_VALUES[label] === v) return false;
    if (label === 'visitor_id' && own.has(v)) return false;
    return true;
  });
}

// A chip is at most 220px (MetaItem): about 32 characters at 12px.
const CHIP_MAX_CHARS = 32;

/** How many chips fit on one line of `budget` characters, a long value
 *  counted at the width it is truncated to and a chip's padding as 3; at
 *  least one. A rough fit: the row also clips, so it never overflows. */
export function chipsThatFit(list: MetaChip[], budget = 80): number {
  let used = 0;
  for (let i = 0; i < list.length; i++) {
    used += Math.min(`${list[i].value}`.length, CHIP_MAX_CHARS) + 3;
    if (used > budget) return Math.max(i, 1);
  }
  return list.length;
}
