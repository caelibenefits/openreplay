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

/** Caeli: the projected value, then the source, each on its own line of the
 *  session list tile with its own hover text. The value had shared the
 *  source's line and a long campaign name truncated it away (2026-10-26). */
export default function SourceInterestLine({ source, campaign, campaignId, interest }: Props) {
  // A row with no projected value yet has no label: show the source alone.
  const label = interestLabel(interest);
  if (!source && !label) return null;
  return (
    <div className="flex flex-col max-w-full">
      {label && (
        <span
          className="text-neutral-700 font-medium truncate"
          title={interestTitle(interest)}
        >
          {label}
        </span>
      )}
      {source && (
        <span
          className="text-neutral-500 truncate"
          title={sourceTitle({ source, campaign, campaignId })}
        >
          {sourceLabel({ source, campaign })}
        </span>
      )}
    </div>
  );
}
