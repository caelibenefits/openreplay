import { Filter } from '@/mstore/types/filterConstants';
import { Button, Card, Divider } from 'antd';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import React from 'react';

import { useStore } from 'App/mstore';

import FilterListHeader from 'Shared/Filters/FilterList/FilterListHeader';
import UnifiedFilterList from 'Shared/Filters/FilterList/UnifiedFilterList';
import FilterSelection from 'Shared/Filters/FilterSelection';

function SessionFilters() {
  const { searchStore, filterStore } = useStore();
  const searchInstance = searchStore.instance;
  // Caeli: collapsed by default, like LogRocket's list, so the sessions are
  // the first thing on the page; the header says how many are applied.
  const [open, setOpen] = React.useState(false);

  const allFilterOptions = filterStore.getScopedCurrentProjectFilters([
    'sessions',
  ]);
  const eventOptions = allFilterOptions.filter((i) => i.isEvent);
  const propertyOptions = allFilterOptions.filter((i) => !i.isEvent);
  const activeFilters = searchInstance.filters.map((f) => f.name);

  const eventFiltersWithIndices = searchInstance.filters
    .map((filter, originalIndex) => ({ filter, originalIndex }))
    .filter(({ filter }) => filter.isEvent);

  const attributeFiltersWithIndices = searchInstance.filters
    .map((filter, originalIndex) => ({ filter, originalIndex }))
    .filter(({ filter }) => !filter.isEvent);

  const eventFilters = eventFiltersWithIndices.map(({ filter }) => filter);
  const attributeFilters = attributeFiltersWithIndices.map(
    ({ filter }) => filter,
  );

  const getOriginalEventIndex = (filteredIndex: number) => {
    return eventFiltersWithIndices[filteredIndex]?.originalIndex ?? -1;
  };

  const getOriginalAttributeIndex = (filteredIndex: number) => {
    return attributeFiltersWithIndices[filteredIndex]?.originalIndex ?? -1;
  };

  const onAddFilter = (filter: Filter) => {
    searchStore.addFilter(filter);
  };

  const onChangeEventsOrder = (
    _e: React.MouseEvent<HTMLButtonElement>,
    { value }: { value: string },
  ) => {
    searchStore.edit({ eventsOrder: value });
    if (eventFilters.length > 1) {
      void searchStore.fetchSessions();
    }
  };

  const handleEventRemove = (filteredIndex: number) => {
    const originalIndex = getOriginalEventIndex(filteredIndex);
    if (originalIndex !== -1) {
      searchStore.removeFilter(originalIndex);
      void searchStore.fetchSessions();
    }
  };

  const handleEventUpdate = (filteredIndex: number, updatedFilter: Filter) => {
    const originalIndex = getOriginalEventIndex(filteredIndex);
    if (originalIndex !== -1) {
      searchStore.updateFilter(originalIndex, updatedFilter);
      void searchStore.fetchSessions();
    }
  };

  const handleAttributeRemove = (filteredIndex: number) => {
    const originalIndex = getOriginalAttributeIndex(filteredIndex);
    if (originalIndex !== -1) {
      searchStore.removeFilter(originalIndex);
      void searchStore.fetchSessions();
    }
  };

  const handleAttributeUpdate = (
    filteredIndex: number,
    updatedFilter: Filter,
  ) => {
    const originalIndex = getOriginalAttributeIndex(filteredIndex);
    if (originalIndex !== -1) {
      searchStore.updateFilter(originalIndex, updatedFilter);
    }
  };

  const moveEventFilter = (
    fromFilteredIndex: number,
    toFilteredIndex: number,
  ) => {
    const fromOriginalIndex = getOriginalEventIndex(fromFilteredIndex);
    const toOriginalIndex = getOriginalEventIndex(toFilteredIndex);
    if (fromOriginalIndex !== -1 && toOriginalIndex !== -1) {
      const updatedFilters = [...searchInstance.filters];
      const filterToMove = updatedFilters.splice(fromOriginalIndex, 1)[0];
      updatedFilters.splice(toOriginalIndex, 0, filterToMove);
      searchStore.edit({ filters: updatedFilters });
    }
  };

  const handleEventAdd = (filter: Filter) => {
    const newFilter = { ...filter, filters: [] };
    searchStore.addFilter(newFilter);
  };

  return (
    <Card
      className="rounded-lg!"
      classNames={{ body: open ? 'p-4!' : 'px-4! py-2!' }}
    >
      <button
        type="button"
        className="flex items-center gap-1 w-full text-left font-medium"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        data-test-id="session-filters-toggle"
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span>Events and filters</span>
        {eventFilters.length + attributeFilters.length > 0 && (
          <span className="text-neutral-500 font-normal">
            {` · ${eventFilters.length} event${eventFilters.length === 1 ? '' : 's'}, ${attributeFilters.length} filter${attributeFilters.length === 1 ? '' : 's'} applied`}
          </span>
        )}
      </button>
      {open && (
        <div className="mt-3">
          <FilterListHeader
            title="Events"
            showEventsOrder={eventFilters.length > 0}
            orderProps={searchInstance}
            onChangeOrder={onChangeEventsOrder}
            filterSelection={
              <FilterSelection
                type="Events"
                filters={eventOptions}
                activeFilters={activeFilters}
                onFilterClick={onAddFilter}
              >
                <Button type="default" size="small">
                  <div className="flex items-center gap-1">
                    <Plus size={16} strokeWidth={1} />
                    <span>Add</span>
                  </div>
                </Button>
              </FilterSelection>
            }
          />

          <UnifiedFilterList
            title="Events"
            filters={eventFilters}
            isDraggable={true}
            showIndices={true}
            className="mt-2"
            handleRemove={handleEventRemove}
            handleUpdate={handleEventUpdate}
            handleAdd={handleEventAdd}
            handleMove={moveEventFilter}
          />

          <Divider className="my-3!" />

          <FilterListHeader
            title="Filters"
            filterSelection={
              <FilterSelection
                type="Filters"
                filters={propertyOptions}
                activeFilters={activeFilters}
                onFilterClick={onAddFilter}
              >
                <Button type="default" size="small">
                  <div className="flex items-center gap-1">
                    <Plus size={16} strokeWidth={1} />
                    <span>Add</span>
                  </div>
                </Button>
              </FilterSelection>
            }
          />

          <UnifiedFilterList
            title="Filters"
            filters={attributeFilters}
            className="mt-2"
            isDraggable={false}
            showIndices={false}
            handleRemove={handleAttributeRemove}
            handleUpdate={handleAttributeUpdate}
            handleAdd={searchStore.addFilter}
            scope="sessions"
          />
        </div>
      )}
    </Card>
  );
}

export default observer(SessionFilters);
