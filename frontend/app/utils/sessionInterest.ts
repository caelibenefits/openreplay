// Caeli: how a session's projected value reads, in the session list and the
// replay header. infra's ad-conversion-upload.py grades each www session with
// the value the ad upload sends, in dollars since SCRUM-1956; the api attaches
// it (search/value.go).

export interface SessionInterest {
  /** null: not a visitor (our team, a crawler, a bot farm) */
  value: number | null;
  /** the projected value in dollars; null: not a visitor */
  dollars?: number | null;
  tier: string;
  ordered?: boolean;
  /** the session is under 2 hours old; the value may still rise */
  provisional?: boolean;
}

export const projected = (dollars: number) => `$${dollars.toFixed(2)}`;

export const interestLabel = (i?: SessionInterest | null) => {
  if (!i) return '';
  if (i.value === null) return `Not a visitor (${i.tier})`;
  if (i.dollars == null) return '';
  return [
    `Projected ${projected(i.dollars)}`,
    i.ordered ? 'ordered' : '',
    i.provisional ? 'so far' : '',
  ]
    .filter(Boolean)
    .join(' · ');
};

// The full text, for a hover.
export const interestTitle = (i?: SessionInterest | null) => {
  if (!i) return '';
  if (i.value === null) return `Not counted as a visitor: ${i.tier}`;
  if (i.dollars == null) return '';
  const parts = [
    `Projected value ${projected(i.dollars)}: the order value a visit that did these things is expected to bring, repeat orders included, and the value sent to the ad platforms for an ad visit (${i.tier.replace(/^\d /, '')})`,
  ];
  if (i.dollars === 0 && i.value)
    parts.push('$0 because this visitor had an earlier www session in the last 30 days, which got the value');
  if (i.ordered)
    parts.push('It reached an order, which the ads get as a purchase');
  if (i.provisional)
    parts.push('Under 2 hours old, so graded again until then');
  return `${parts.join('. ')}.`;
};
