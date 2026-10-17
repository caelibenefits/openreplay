// Caeli: PrivateRoutes loads the filter catalog on mount and the first search
// waits for it; both must share one /filters request.
const mockFetch = jest.fn();

jest.mock('App/services', () => ({
  filterService: { fetchFilters: (...a: any[]) => mockFetch(...a) },
  searchService: {},
}));
jest.mock('@/mstore/index', () => ({ projectStore: { activeSiteId: null } }));

import FilterStore from '../../app/mstore/filterStore';

describe('FilterStore.fetchFilters', () => {
  it('joins the load already in flight instead of sending a second request', async () => {
    let release: (v: any) => void = () => {};
    mockFetch.mockImplementationOnce(() => new Promise((r) => (release = r)));
    const store = new FilterStore();
    const first = store.fetchFilters('1');
    const second = store.fetchFilters('1');
    release({ data: {} });
    await Promise.all([first, second]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
