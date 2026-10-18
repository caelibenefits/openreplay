import { describe, expect, it } from '@jest/globals';

import { duplicateIds } from '../../app/utils/campaignNames';

describe('duplicateIds', () => {
  it('finds an ID listed twice, ignoring spaces', () => {
    expect(
      duplicateIds([
        { campaignId: '1', name: 'a' },
        { campaignId: ' 1 ', name: 'b' },
        { campaignId: '2', name: 'c' },
      ]),
    ).toEqual(['1']);
  });

  it('ignores blank IDs', () => {
    expect(
      duplicateIds([
        { campaignId: '', name: 'a' },
        { campaignId: ' ', name: 'b' },
      ]),
    ).toEqual([]);
  });
});
