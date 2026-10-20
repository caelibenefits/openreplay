import { describe, expect, test } from '@jest/globals';

import { interestLabel, interestTitle } from '../../app/utils/sessionInterest';

describe('session interest text', () => {
  test('a graded visit shows its value', () => {
    expect(interestLabel({ value: 10, tier: '5 intent' })).toBe('Interest 10');
    expect(interestTitle({ value: 10, tier: '5 intent' })).toContain(
      'Interest value 10 of 30',
    );
    expect(interestTitle({ value: 10, tier: '5 intent' })).toContain(
      '(intent)',
    );
  });

  test('zero is a value, not nothing', () => {
    expect(interestLabel({ value: 0, tier: '1 bounce' })).toBe('Interest 0');
  });

  test('an order and a young session say so', () => {
    expect(
      interestLabel({
        value: 0,
        tier: '5 intent',
        ordered: true,
        provisional: true,
      }),
    ).toBe('Interest 0 · ordered · so far');
  });

  test('not a visitor names why; no grade shows nothing', () => {
    expect(interestLabel({ value: null, tier: 'crawler' })).toBe(
      'Not a visitor (crawler)',
    );
    expect(interestLabel(undefined)).toBe('');
    expect(interestTitle(null)).toBe('');
  });
});
