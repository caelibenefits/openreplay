// Caeli: how a session's interest value reads, in the session list and the
// replay header. infra's session-value.py grades each www session with the
// value the ad upload sends (0 and up); the api attaches it (search/value.go).

export interface SessionInterest {
  /** null: not a visitor (our team, a crawler, a bot farm) */
  value: number | null;
  tier: string;
  ordered?: boolean;
  /** the session is under 2 hours old; the value may still rise */
  provisional?: boolean;
}

export const interestLabel = (i?: SessionInterest | null) => {
  if (!i) return '';
  if (i.value === null) return `Not a visitor (${i.tier})`;
  return [
    `Interest ${i.value}`,
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
  const parts = [
    `Interest value ${i.value} (its highest action plus points for each further one), the value sent to the ad platforms for an ad visit (${i.tier.replace(/^\d /, '')})`,
  ];
  if (i.ordered)
    parts.push('It reached an order, which the ads get as a purchase');
  if (i.provisional)
    parts.push('Under 2 hours old, so graded again until then');
  return `${parts.join('. ')}.`;
};
