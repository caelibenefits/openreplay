import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import SimpleStore from '../../../player/src/common/SimpleStore';
import Animator from '../../../player/src/player/Animator';
import useResumeAfterDrag from 'Components/Session_/Player/Controls/useResumeAfterDrag';
import {
  getFilteredEntries,
  groupFiltersByCategory,
  listFiltersForCategory,
} from 'Shared/Filters/FilterModal/utils';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// --- the player's click hold (pauseFor) vs the viewer's play/pause ---------
describe('Animator click hold', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const make = () => {
    const store = new SimpleStore({
      ...Animator.INITIAL_STATE,
      ready: true,
      endTime: 60_000,
    } as any);
    const mm = { move: jest.fn() } as any;
    const a = new Animator(store as any, mm);
    a.play();
    return { a, store };
  };

  it('a toggle during the hold pauses, and the hold does not resume it', () => {
    const { a, store } = make();
    a.pauseFor(750);
    a.togglePlay(); // Space / the play button while the replay holds on a click
    expect(store.get().playing).toBe(false);
    jest.advanceTimersByTime(1000);
    expect(store.get().playing).toBe(false);
  });

  it('a pause during the hold is not undone when the hold ends', () => {
    const { a, store } = make();
    a.pauseFor(750);
    a.pause();
    jest.advanceTimersByTime(1000);
    expect(store.get().playing).toBe(false);
  });

  it('an untouched hold still resumes', () => {
    const { a, store } = make();
    a.pauseFor(750);
    expect(store.get().playing).toBe(false);
    jest.advanceTimersByTime(1000);
    expect(store.get().playing).toBe(true);
  });
});

// --- timeline drag ---------------------------------------------------------
describe('useResumeAfterDrag', () => {
  const harness = () => {
    const player = { pause: jest.fn(), play: jest.fn() };
    let api: ReturnType<typeof useResumeAfterDrag> | undefined;
    function H() {
      api = useResumeAfterDrag(player);
      return null;
    }
    const root = createRoot(document.createElement('div'));
    act(() => root.render(<H />));
    return { player, api: () => api! };
  };

  it('resumes a drag that started while playing', () => {
    const { player, api } = harness();
    api().onDragMove(true);
    api().onDragEnd();
    expect(player.pause).toHaveBeenCalledTimes(1);
    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it('does not resume a paused replay after an earlier drag made while playing', () => {
    const { player, api } = harness();
    api().onDragMove(true); // drag 1, while playing
    api().onDragEnd();
    player.play.mockClear();
    api().onDragMove(false); // viewer paused, drag 2
    api().onDragEnd();
    expect(player.play).not.toHaveBeenCalled();
  });
});

// --- Events panel search must not take the keyboard ------------------------
jest.mock('App/components/Session/playerContext', () => {
  const R = jest.requireActual('react') as typeof React;
  return { PlayerContext: R.createContext({ player: { toggleEvents: () => {} } }) };
});

describe('EventSearch', () => {
  it.each([
    ['Session_', 'Components/Session_/EventsBlock/EventSearch/EventSearch'],
    ['ReplayPlayer', 'Components/Session/Player/ReplayPlayer/EventsBlock/EventSearch/EventSearch'],
  ])('%s search box does not grab focus on open (Space reaches the player)', (_n, path) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const EventSearch = require(path).default;
    const el = document.createElement('div');
    document.body.appendChild(el);
    const root = createRoot(el);
    act(() => root.render(<EventSearch value="" onChange={() => {}} eventsText="events" />));
    const input = el.querySelector('input');
    expect(input).not.toBeNull();
    expect(document.activeElement).not.toBe(input);
    act(() => root.unmount());
    el.remove();
  });
});

// --- searched metadata filter keeps its category ---------------------------
describe('listFiltersForCategory', () => {
  const surface = {
    id: 'meta_2',
    name: 'metadata_3',
    displayName: 'surface',
    category: 'metadata',
    isEvent: false,
  } as any;
  const other = { id: 'x', name: 'user_city', displayName: 'City', category: 'user', isEvent: false } as any;

  it('a filter found by search keeps category "metadata" and gets a label', () => {
    const grouped = groupFiltersByCategory([surface, other]);
    const { matchingCategories, matchingFilters } = getFilteredEntries('surf', grouped, 'Filters');
    const listed = listFiltersForCategory('All Filters', matchingCategories, matchingFilters);
    expect(listed).toHaveLength(1);
    expect(listed[0].category).toBe('metadata');
    expect((listed[0] as any).categoryLabel).toBe('Metadata');
    expect(listed[0].id).toBe('meta_2');
  });

  it('picking the category lists the catalog filter unchanged', () => {
    const grouped = groupFiltersByCategory([surface, other]);
    const { matchingCategories, matchingFilters } = getFilteredEntries('', grouped, 'Filters');
    expect(listFiltersForCategory('Metadata', matchingCategories, matchingFilters)).toEqual([surface]);
  });
});
