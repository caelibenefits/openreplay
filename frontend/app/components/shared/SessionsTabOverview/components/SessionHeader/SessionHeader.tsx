import React from 'react';
import Period from 'Types/app/period';
import SelectDateRange from 'Shared/SelectDateRange';
import { useStore } from 'App/mstore';
import { observer } from 'mobx-react-lite';
import { Button, Tooltip } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import SessionSort from '../SessionSort';
import { SortDropdown } from '../SessionSort/SessionSort';
import { MIN_EVENTS_OPTIONS } from 'App/mstore/searchStore';

function SessionHeader() {
  const { searchStore } = useStore();
  const { startDate, endDate, rangeValue } = searchStore.instance;

  const period = Period({
    start: startDate,
    end: endDate,
    rangeName: rangeValue,
  });

  const onDateChange = (e: any) => {
    const dateValues = e.toJSON();
    searchStore.edit(dateValues);
    void searchStore.fetchSessions(true);
  };

  // Caeli: re-run the current search now. A rolling range (e.g. last 24h) is
  // recomputed from the current time by toSearch(), so this also pulls in
  // sessions that ended since the list loaded.
  const onRefresh = () => {
    searchStore.updateLatestSessionCount(0);
    void searchStore.fetchSessions(true);
  };

  return (
    <div
      className="flex items-center px-4 py-3 justify-between w-full"
      data-test-id="session-list-header"
    >
      {/* Caeli: no All/Errors/Bad Requests/Click Rage/Crashes/Incidents tabs
          (like LogRocket's list): the toggles below are how we narrow it. */}
      <div className={`flex w-full flex-wrap gap-2 justify-end`}>
        <div className={'flex items-start flex-row'}>
          <SelectDateRange
            isAnt
            period={period}
            onChange={onDateChange}
            right
          />
          <SessionSort />
          <div className="px-[7px]">
            <SortDropdown
              defaultOption={searchStore.hideBots ? 'hide' : 'show'}
              current={searchStore.hideBots ? 'Bots hidden' : 'Bots shown'}
              sortOptions={[
                { key: 'hide', label: 'Hide bots (Googlebot, GoogleOther, Applebot, GPTBot, …)' },
                { key: 'show', label: 'Show bots' },
              ]}
              onSort={({ key }: { key: string }) => searchStore.setHideBots(key === 'hide')}
            />
          </div>
          <div className="px-[7px]">
            <SortDropdown
              defaultOption={searchStore.hideInternal ? 'hide' : 'show'}
              current={searchStore.hideInternal ? 'Internal hidden' : 'Internal shown'}
              sortOptions={[
                { key: 'hide', label: 'Hide internal (our IPs: office, e2e, canaries)' },
                { key: 'show', label: 'Show internal' },
              ]}
              onSort={({ key }: { key: string }) => searchStore.setHideInternal(key === 'hide')}
            />
          </div>
          <div className="px-[7px]">
            <SortDropdown
              defaultOption={String(searchStore.minEvents)}
              current={searchStore.minEvents ? `Events > ${searchStore.minEvents}` : 'Any events'}
              sortOptions={MIN_EVENTS_OPTIONS.map((n) => ({
                key: String(n),
                label: n ? `More than ${n} event${n === 1 ? '' : 's'}` : 'Any number of events',
              }))}
              onSort={({ key }: { key: string }) => searchStore.setMinEvents(Number(key))}
            />
          </div>
          <Tooltip title="Refresh">
            <Button
              type="text"
              size="small"
              className="flex items-center"
              aria-label="Refresh sessions"
              data-test-id="session-list-refresh"
              icon={<SyncOutlined spin={searchStore.searchInProgress} />}
              onClick={onRefresh}
            >
              Refresh
            </Button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

export default observer(SessionHeader);
