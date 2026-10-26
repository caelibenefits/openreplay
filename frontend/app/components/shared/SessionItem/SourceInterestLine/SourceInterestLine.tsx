import React from 'react';

import { interestLabel, interestTitle } from 'App/utils/sessionInterest';
import { sourceLabel, sourceTitle } from 'App/utils/sessionSource';

type Interest = Parameters<typeof interestLabel>[0];

interface Props {
  source?: string;
  campaign?: string;
  campaignId?: string;
  interest?: Interest;
}

/** Caeli: "<source> · <interest>" on one line of the session list tile, each
 *  part with its own hover text (2026-10-21: tiles had grown to 7-8 lines). */
export default function SourceInterestLine({ source, campaign, campaignId, interest }: Props) {
  // A row with no projected value yet has no label: show the source alone.
  const label = interestLabel(interest);
  if (!source && !label) return null;
  return (
    <div className="text-neutral-500 truncate max-w-full">
      {source && (
        <span title={sourceTitle({ source, campaign, campaignId })}>
          {sourceLabel({ source, campaign })}
        </span>
      )}
      {source && label && ' · '}
      {label && <span title={interestTitle(interest)}>{label}</span>}
    </div>
  );
}
