import { describe, expect, it } from '@jest/globals';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { chipsThatFit, visibleMeta } from '../../app/utils/sessionMeta';
import SourceInterestLine from '../../app/components/shared/SessionItem/SourceInterestLine';

const chip = (label: string, value: string) => ({ label, value });

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
function renderToStaticMarkup(el: React.ReactElement): string {
  const div = document.createElement('div');
  const root = createRoot(div);
  act(() => root.render(el));
  const html = div.innerHTML;
  act(() => root.unmount());
  return html;
}

describe('session list metadata chips', () => {
  // Caeli (2026-10-21): tiles grew to 7-8 lines; chips that repeat the tile
  // or hold the common value are dropped.
  it('drops the default platform and surface, keeps the others', () => {
    const list = [chip('platform', 'web'), chip('surface', 'www'), chip('platform', 'ios_app'), chip('surface', 'pay')];
    expect(visibleMeta(list, [])).toEqual([chip('platform', 'ios_app'), chip('surface', 'pay')]);
  });

  it("drops a visitor_id that is the session's own id, keeps another", () => {
    const own = '6ed07287-4ca6-496c-a5e2-6aabd822bd88';
    const list = [chip('visitor_id', own), chip('ip', '98.37.80.7')];
    expect(visibleMeta(list, [own])).toEqual([chip('ip', '98.37.80.7')]);
    expect(visibleMeta([chip('visitor_id', 'other')], [own])).toEqual([chip('visitor_id', 'other')]);
    // No id to compare with: nothing is dropped by it.
    expect(visibleMeta([chip('visitor_id', own)], [null, undefined, ''])).toHaveLength(1);
  });

  it('fits chips to one line and leaves the rest to "+N"', () => {
    const list = [chip('ip', '98.37.80.7'), chip('pay', 'pay_ed223af39ea2cd48455a7af9'), chip('surface', 'pay')];
    expect(chipsThatFit(list, 80)).toBe(3);
    expect(chipsThatFit(list, 20)).toBe(1);
    // A long value counts at its truncated width, not its full length.
    const long = [chip('a', 'x'.repeat(200)), chip('b', 'y'), chip('c', 'z')];
    expect(chipsThatFit(long, 80)).toBe(3);
    expect(chipsThatFit([chip('x', 'a'.repeat(200))], 90)).toBe(1); // one always shows
    expect(chipsThatFit([], 90)).toBe(0);
  });

  it('puts source and interest on one line, each with its hover text', () => {
    const html = renderToStaticMarkup(
      React.createElement(SourceInterestLine, {
        source: 'Google Ads', campaign: 'Shop', campaignId: '123',
        interest: { value: 36, dollars: 5.53, tier: '5 intent', provisional: true } as any,
      }),
    );
    // One block holding both parts.
    expect(html.match(/<div/g)).toHaveLength(1);
    expect(html.replace(/<[^>]+>/g, '')).toBe('Google Ads · Shop · Projected $5.53 · so far');
    expect(html).toContain('title="Google Ads · campaign Shop (123)"');
    expect(html).toContain('title="Projected value $5.53');
    const alone = renderToStaticMarkup(React.createElement(SourceInterestLine, { interest: { value: 5, dollars: 1, tier: '3 engaged' } as any }));
    expect(alone.replace(/<[^>]+>/g, '')).toBe('Projected $1.00');
    // A row graded before it had dollars: the source alone, no dangling separator.
    const ungraded = renderToStaticMarkup(React.createElement(SourceInterestLine, {
      source: 'Google Ads', campaign: 'Shop', interest: { value: 5, tier: '3 engaged' } as any,
    }));
    expect(ungraded.replace(/<[^>]+>/g, '')).toBe('Google Ads · Shop');
    expect(renderToStaticMarkup(React.createElement(SourceInterestLine, { interest: { value: 5, tier: '3 engaged' } as any }))).toBe('');
    expect(renderToStaticMarkup(React.createElement(SourceInterestLine, {}))).toBe('');
  });
});
