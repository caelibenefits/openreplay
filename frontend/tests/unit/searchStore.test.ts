import { describe, expect, it, beforeEach, jest } from '@jest/globals';

jest.mock('App/mstore/types/filterItem', () => {
  return class FilterItem {
    key: any;
    value: any;
    operator: any;
    source: any;
    sourceOperator: any;
    isEvent: any;
    filters: any;
    constructor(data: any = {}) {
      Object.assign(this, data);
    }
    fromJson(data: any) {
      Object.assign(this, data);
      return this;
    }
    merge(data: any) {
      Object.assign(this, data);
    }
    toJson() {
      return {
        type: this.key || this.type,
        value: this.value,
        operator: this.operator,
        source: this.source,
        sourceOperator: this.sourceOperator,
        isEvent: this.isEvent,
        filters: Array.isArray(this.filters) ? this.filters : [],
      };
    }
  };
});

jest.mock('Types/filter/newFilter', () => {
  const { FilterKey, FilterCategory } = require('Types/filter/filterType');
  return {
    filtersMap: {
      [FilterKey.USERID]: {
        key: FilterKey.USERID,
        type: FilterKey.USERID,
        category: FilterCategory.USER,
        operator: 'is',
        value: [''],
      },
      [FilterKey.DURATION]: {
        key: FilterKey.DURATION,
        type: FilterKey.DURATION,
        category: FilterCategory.SESSION,
        operator: 'is',
        value: [0, 0],
      },
      [FilterKey.ISSUE]: {
        key: FilterKey.ISSUE,
        type: FilterKey.ISSUE,
        category: FilterCategory.ISSUE,
        operator: 'is',
        value: [],
      },
    },
    conditionalFiltersMap: {},
    generateFilterOptions: jest.fn(() => []),
    liveFiltersMap: {},
    mobileConditionalFiltersMap: {},
  };
});

const mockSessionFetch = jest.fn().mockResolvedValue({});

const mockSessionStore = {
  fetchSessions: mockSessionFetch,
  total: 0,
  clearList: jest.fn(),
};
const mockSettingsStore = {
  sessionSettings: { durationFilter: { count: 0 } },
};

jest.mock('App/services', () => ({
  searchService: { fetchSavedSearch: jest.fn() },
  sessionService: {
    getSessions: jest.fn().mockResolvedValue({ sessions: [], total: 0 }),
  },
}));
const mockFilterStore = {
  checkDefaultSubfilters: jest.fn(() => false),
  getEventFilters: jest.fn(async () => [] as any[]),
  findEvent: jest.fn(),
  // Caeli: the Bots/Internal toggles read the catalog for their columns.
  fetchFilters: jest.fn(async () => undefined),
  getCurrentProjectFilters: jest.fn(() => [] as any[]),
};

jest.mock('App/mstore', () => ({
  sessionStore: mockSessionStore,
  settingsStore: mockSettingsStore,
  filterStore: mockFilterStore,
  projectStore: { activeSiteId: 1 },
}));

import SearchStore, {
  CATALOG_WAIT_MS,
  checkValues,
  filterMap,
} from '../../app/mstore/searchStore';
import SavedSearch from '../../app/mstore/types/savedSearch';
import { FilterCategory, FilterKey } from '../../app/types/filter/filterType';

describe('searchStore utilities', () => {
  it('checkValues handles duration', () => {
    const res = checkValues(FilterKey.DURATION, ['', 1000]);
    expect(res).toEqual([0, 1000]);
  });

  it('checkValues filters empty values', () => {
    const res = checkValues(FilterKey.USERID, ['a', '', null]);
    expect(res).toEqual(['a']);
  });

  it('filterMap maps metadata type correctly', () => {
    const data = {
      category: FilterCategory.METADATA,
      value: ['val'],
      key: '_source',
      operator: 'is',
      sourceOperator: 'is',
      source: '_source',
      custom: false,
      isEvent: false,
      filters: null,
    };
    const mapped = filterMap(data as any);
    expect(mapped.type).toBe(FilterKey.METADATA);
    expect(mapped.source).toBe('source');
    expect(mapped.value).toEqual(['val']);
  });
});

describe('SearchStore class', () => {
  let store: SearchStore;
  beforeEach(() => {
    store = new SearchStore();
    mockSessionFetch.mockClear();
  });

  it('addFilterByKeyAndValue adds filter and triggers fetch', async () => {
    store.addFilterByKeyAndValue(FilterKey.USERID, ['42']);
    expect(store.instance.filters.length).toBe(1);
    // Caeli: the search waits for the filter catalog first (ensureFilterCatalog).
    await new Promise((r) => setTimeout(r, 0));
    expect(mockSessionFetch).toHaveBeenCalled();
  });

  // Caeli: a hung /filters must not hold the list back; past CATALOG_WAIT_MS the
  // search goes without the catalog.
  it('fetchSessions does not wait on a hung filter catalog', async () => {
    jest.useFakeTimers();
    try {
      store.hideInternal = true;
      mockFilterStore.fetchFilters.mockImplementationOnce(() => new Promise(() => {}));
      const done = store.fetchSessions();
      await jest.advanceTimersByTimeAsync(CATALOG_WAIT_MS);
      await done;
      expect(mockSessionFetch).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('fetchSessions applies duration filter from settings', async () => {
    mockSettingsStore.sessionSettings.durationFilter = {
      operator: '<',
      count: 1,
      countType: 'sec',
    };
    await store.fetchSessions();
    const call = mockSessionFetch.mock.calls[0][0];
    const duration = call.filters.find(
      (f: any) => f.name === FilterKey.DURATION,
    );
    expect(duration).toBeTruthy();
    expect(duration.value).toEqual(["1000"]);
  });

  // Caeli: a toggle that narrows the list kept the page, so page 18 of the
  // wider list asked for an offset the narrower one did not reach and showed
  // "No sessions" (2026-10-13, query_log: OFFSET 170, 0 rows).
  it.each([
    ['setMinEvents', (st: SearchStore) => st.setMinEvents(1)],
    ['setHideInternal', (st: SearchStore) => st.setHideInternal(true)],
    ['setHideBots', (st: SearchStore) => st.setHideBots(true)],
  ])('%s starts the list again at page 1', async (_name, toggle) => {
    store.updateCurrentPage(18);
    toggle(store);
    expect(store.currentPage).toBe(1);
    await new Promise((r) => setTimeout(r, 0));
    const call = mockSessionFetch.mock.calls.at(-1)?.[0] as any;
    expect(call.page).toBe(1);
  });
});
