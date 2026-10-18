import { describe, expect, test } from '@jest/globals';

import { sourceLabel, sourceTitle } from '../../app/utils/sessionSource';

describe('session source text', () => {
  const named = {
    source: 'Google Ads',
    campaign: 'Product Search',
    campaignId: '24356000612',
  };

  test('the label shows the campaign name; the hover adds its ID', () => {
    expect(sourceLabel(named)).toBe('Google Ads · Product Search');
    expect(sourceTitle(named)).toBe(
      'Google Ads · campaign Product Search (24356000612)',
    );
  });

  test('an unnamed campaign shows as its ID, once', () => {
    const unnamed = { source: 'Google Ads', campaign: '24356000612' };
    expect(sourceLabel(unnamed)).toBe('Google Ads · 24356000612');
    expect(sourceTitle(unnamed)).toBe('Google Ads · campaign 24356000612');
  });

  test('no campaign shows the source alone; nothing shows nothing', () => {
    expect(sourceLabel({ source: 'Untagged' })).toBe('Untagged');
    expect(sourceTitle({ source: 'Untagged' })).toBe('Untagged');
    expect(sourceLabel({})).toBe('');
    expect(sourceTitle({})).toBe('');
  });
});
