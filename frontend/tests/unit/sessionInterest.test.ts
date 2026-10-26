import { describe, expect, test } from '@jest/globals';

import { interestLabel, interestTitle } from '../../app/utils/sessionInterest';

describe('session projected value text', () => {
  test('a graded visit shows its projected dollars', () => {
    const v = { value: 10, dollars: 5.53, tier: '5 intent' };
    expect(interestLabel(v)).toBe('Projected $5.53');
    expect(interestTitle(v)).toContain('Projected value $5.53: the order value');
    expect(interestTitle(v)).toContain('(intent)');
    expect(interestLabel(v)).not.toContain('Interest');
  });

  test('zero is a value, not nothing', () => {
    expect(interestLabel({ value: 0, dollars: 0, tier: '1 bounce' })).toBe('Projected $0.00');
  });

  test('a returning visitor says why it is $0', () => {
    const back = { value: 12, dollars: 0, tier: '4 interested' };
    expect(interestTitle(back)).toContain('earlier www session');
    expect(interestTitle({ value: 0, dollars: 0, tier: '1 bounce' })).not.toContain('earlier www session');
  });

  test('an order and a young session say so', () => {
    expect(
      interestLabel({
        value: 0,
        dollars: 0,
        tier: '5 intent',
        ordered: true,
        provisional: true,
      }),
    ).toBe('Projected $0.00 · ordered · so far');
  });

  test('not a visitor names why; no grade or no dollars shows nothing', () => {
    expect(interestLabel({ value: null, dollars: null, tier: 'crawler' })).toBe(
      'Not a visitor (crawler)',
    );
    expect(interestLabel(undefined)).toBe('');
    expect(interestTitle(null)).toBe('');
    expect(interestLabel({ value: 5, tier: '3 engaged' })).toBe('');
  });
});
