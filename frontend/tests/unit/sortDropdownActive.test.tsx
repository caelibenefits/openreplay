import { describe, expect, it, jest } from '@jest/globals';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { SortDropdown } from 'Shared/SessionsTabOverview/components/SessionSort/SessionSort';

// Caeli: a toolbar toggle that narrows the session list (Bots hidden, Internal
// hidden, Projected $N+) is drawn as a pill, so it cannot empty the list
// unnoticed the way "Projected $20+" hid every extension session.
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const render = (active?: boolean) => {
  const el = document.createElement('div');
  const root = createRoot(el);
  act(() => root.render(
    <SortDropdown
      current="Projected $20+"
      sortOptions={[]}
      onSort={() => {}}
      {...(active === undefined ? {} : { active })}
    />,
  ));
  const html = el.innerHTML;
  act(() => root.unmount());
  return html;
};

describe('SortDropdown active state', () => {
  it('marks and tints the trigger when the toggle narrows the list', () => {
    const html = render(true);
    expect(html).toContain('data-active="true"');
    expect(html).toContain('bg-active-blue');
    expect(html).toContain('Projected $20+');
  });

  it('stays plain when inactive or when the caller does not say', () => {
    for (const html of [render(false), render()]) {
      expect(html).not.toContain('data-active');
      expect(html).not.toContain('bg-active-blue');
    }
  });
});

// The header decides which toggles are active; a toggle left at its widest
// setting ("Bots shown", "Any value") must not be drawn as a filter.
jest.mock('Shared/SelectDateRange', () => () => null);
jest.mock('App/mstore', () => ({ useStore: () => ({ searchStore: mockStore }) }));
let mockStore: any;

describe('SessionHeader active toggles', () => {
  const header = (s: { hideBots: boolean; hideInternal: boolean; minInterest: number }) => {
    mockStore = {
      ...s,
      instance: { startDate: 0, endDate: 1, rangeValue: 'LAST_24_HOURS', sort: 'startTs', order: 'desc' },
      searchInProgress: false,
    };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SessionHeader = require('Shared/SessionsTabOverview/components/SessionHeader/SessionHeader').default;
    const el = document.createElement('div');
    const root = createRoot(el);
    act(() => root.render(<SessionHeader />));
    const active = [...el.querySelectorAll('[data-active="true"]')].map((n) => n.textContent);
    act(() => root.unmount());
    return active;
  };

  it('draws every narrowing toggle as active', () => {
    expect(header({ hideBots: true, hideInternal: true, minInterest: 20 })).toEqual([
      'Bots hidden',
      'Internal hidden',
      'Projected $20+',
    ]);
  });

  it('draws none when every toggle is at its widest', () => {
    expect(header({ hideBots: false, hideInternal: false, minInterest: 0 })).toEqual([]);
  });
});
