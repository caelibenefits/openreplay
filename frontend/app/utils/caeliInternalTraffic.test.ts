import { describe, expect, it } from '@jest/globals';
import {
  excludeInternalFilters,
  excludeTaggedBotsFilter,
  INTERNAL_IPS,
  ipColumn,
  ipMatchers,
  metadataColumn,
} from './caeliInternalTraffic';

describe('ipMatchers', () => {
  it('keeps single addresses whole and turns octet-aligned CIDRs into prefixes', () => {
    expect(ipMatchers(['67.160.35.32', '66.249.0.0/16', '10.0.0.0/8', '192.168.1.0/24', '1.2.3.4/32'])).toEqual({
      exact: ['67.160.35.32', '1.2.3.4'],
      prefixes: ['66.249.', '10.', '192.168.1.'],
    });
  });

  it('refuses a CIDR a prefix cannot express, rather than matching the wrong range', () => {
    expect(() => ipMatchers(['66.249.64.0/19'])).toThrow(/octet-aligned/);
  });

  it('accepts the whole list as slack-app holds it', () => {
    expect(() => ipMatchers(INTERNAL_IPS)).not.toThrow();
  });
});

describe('excludeInternalFilters', () => {
  it('excludes the exact addresses and the CIDR prefixes on the ip column', () => {
    const filters = excludeInternalFilters('metadata_7', ['67.160.35.32', '76.231.26.97', '66.249.0.0/16']);
    expect(filters).toEqual([
      expect.objectContaining({ name: 'metadata_7', operator: 'isNot', value: ['67.160.35.32', '76.231.26.97'] }),
      expect.objectContaining({ name: 'metadata_7', operator: 'notStartsWith', value: ['66.249.'] }),
    ]);
    // Session properties, not events: the backend only treats metadata as a
    // session property when autoCaptured.
    for (const f of filters) expect(f).toMatchObject({ isEvent: false, autoCaptured: true });
  });

  it('chunks to the API cap of 10 values per filter', () => {
    const many = Array.from({ length: 23 }, (_, i) => `10.0.0.${i}`);
    const filters = excludeInternalFilters('metadata_7', many);
    expect(filters.map((f) => f.value.length)).toEqual([10, 10, 3]);
  });
});

describe('ipColumn', () => {
  it('finds the column the project declared "ip" in', () => {
    expect(ipColumn([{ name: 'metadata_1', displayName: 'visitor_id' }, { name: 'metadata_7', displayName: 'ip' }])).toBe('metadata_7');
  });

  it('is null until the catalog has it', () => {
    expect(ipColumn([])).toBeNull();
    expect(ipColumn([{ name: 'ip', displayName: 'ip' }])).toBeNull();
  });
});

describe('excludeTaggedBotsFilter', () => {
  it('keeps only sessions with no bot tag, on the column the project declared it in', () => {
    const column = metadataColumn([{ name: 'metadata_8', displayName: 'bot' }], 'bot');
    expect(column).toBe('metadata_8');
    expect(excludeTaggedBotsFilter(column!)).toMatchObject({
      name: 'metadata_8',
      operator: 'isUndefined',
      isEvent: false,
      autoCaptured: true,
    });
  });
});
