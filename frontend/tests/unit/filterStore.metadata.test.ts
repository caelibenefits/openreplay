// Caeli: a session-tile metadata chip must resolve to the metadata_N column,
// not to an event property that shares its label.
jest.mock('App/services', () => ({
  filterService: { fetchFilters: jest.fn() },
  searchService: {},
}));
jest.mock('@/mstore/index', () => ({ projectStore: { activeSiteId: 1 } }));

import FilterStore from '../../app/mstore/filterStore';

const eventProp = {
  id: 'p1',
  name: 'surface',
  displayName: 'surface',
  isEvent: false,
  autoCaptured: false,
  category: 'custom',
};
const metadata = {
  id: 'meta_2',
  name: 'metadata_3',
  displayName: 'surface',
  isEvent: false,
  autoCaptured: true,
  category: 'metadata',
};

describe('FilterStore.findMetadataFilter', () => {
  it('picks the metadata column even when an event property with the same label comes first', () => {
    const store = new FilterStore();
    store.setFilters('1', [eventProp, metadata] as any);
    const f = store.findMetadataFilter('surface');
    expect(f?.name).toBe('metadata_3');
  });

  it('returns undefined when the key is not a metadata field', () => {
    const store = new FilterStore();
    store.setFilters('1', [eventProp] as any);
    expect(store.findMetadataFilter('surface')).toBeUndefined();
  });

  it('returns a copy, so setting its value leaves the catalog untouched', () => {
    const store = new FilterStore();
    store.setFilters('1', [metadata] as any);
    const f = store.findMetadataFilter('surface')!;
    f.value = ['panel'];
    expect((store.getFilters('1')[0] as any).value).toBeUndefined();
  });
});

describe('FilterStore.filterForMetaChip', () => {
  it('turns the chip SessionMetaList sends into a metadata_N filter with its value', () => {
    const store = new FilterStore();
    store.setFilters('1', [eventProp, metadata] as any);
    const f = store.filterForMetaChip({ name: '_surface', value: 'panel' });
    expect(f?.name).toBe('metadata_3');
    expect(f?.value).toEqual(['panel']);
  });
});
