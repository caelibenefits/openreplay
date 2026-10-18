import { describe, expect, it } from '@jest/globals';

import { duplicateIds, incompleteRows } from '../../app/utils/campaignNames';

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

describe('incompleteRows', () => {
  it('flags a row with only an ID or only a name, not a blank one', () => {
    const rows = [
      { campaignId: '1', name: '' },
      { campaignId: ' ', name: 'b' },
      { campaignId: '', name: '' },
      { campaignId: '2', name: 'c' },
    ];
    expect(incompleteRows(rows)).toEqual([rows[0], rows[1]]);
  });
});
