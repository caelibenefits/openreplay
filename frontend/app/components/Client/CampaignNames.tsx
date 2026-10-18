import withPageTitle from 'HOCs/withPageTitle';
import { Button, Input } from 'antd';
import { Trash2 } from 'lucide-react';
import React from 'react';
import { toast } from 'react-toastify';

import { sessionService } from 'App/services';
import type { CampaignName } from 'App/services/SessionService';
import { duplicateIds, incompleteRows } from 'App/utils/campaignNames';

import PreferencesPage from './PreferencesPage';

// Caeli: names for the campaign IDs on the session list. The api swaps an ID
// for its name (search/campaign_names.go); an ID with no name shows as is.
// Saving replaces the project's whole list.

type Row = CampaignName & { key: number };

let nextKey = 0; // unique row keys for React; only ever compared
const toRows = (names: CampaignName[]): Row[] =>
  names.map((n) => ({ ...n, key: nextKey++ }));

function CampaignNames() {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  // Save replaces the whole list, so it stays off until the list has loaded.
  const [loadFailed, setLoadFailed] = React.useState(false);

  React.useEffect(() => {
    sessionService
      .getCampaignNames()
      .then((names) => setRows(toRows(names)))
      .catch(() => {
        setLoadFailed(true);
        toast.error('Could not load campaign names');
      })
      .finally(() => setLoading(false));
  }, []);

  const update = (key: number, field: keyof CampaignName, value: string) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
    setDirty(true);
  };
  const remove = (key: number) => {
    setRows((rs) => rs.filter((r) => r.key !== key));
    setDirty(true);
  };
  const add = () => {
    setRows((rs) => [...rs, { key: nextKey++, campaignId: '', name: '' }]);
    setDirty(true);
  };

  const dups = duplicateIds(rows);
  const incomplete = new Set(incompleteRows(rows).map((r) => r.key));

  const save = async () => {
    setSaving(true);
    try {
      const saved = await sessionService.setCampaignNames(
        rows.map(({ campaignId, name }) => ({ campaignId, name })),
      );
      setRows(toRows(saved));
      setDirty(false);
      toast.success('Campaign names saved');
    } catch (e: any) {
      toast.error(e?.message || 'Could not save campaign names');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PreferencesPage
      title="Campaign Names"
      help="The session list shows a campaign's name in place of its ID. The ID is the utm_campaign value, or Google Ads' campaign ID."
      actions={
        <>
          <Button size="small" onClick={add} disabled={loading || loadFailed || saving}>
            Add campaign
          </Button>
          <Button
            type="primary"
            size="small"
            onClick={save}
            loading={saving}
            disabled={
              loading ||
              loadFailed ||
              !dirty ||
              dups.length > 0 ||
              incomplete.size > 0
            }
          >
            Save
          </Button>
        </>
      }
    >
      {loading ? null : loadFailed ? (
        <div className="text-red-500">
          Could not load campaign names. Reload the page to try again.
        </div>
      ) : (
        <div className="flex flex-col gap-2 max-w-2xl">
          {rows.length === 0 && (
            <div className="text-neutral-500">
              No campaign names yet. Add one with its ID and the name to show.
            </div>
          )}
          {rows.length > 0 && (
            <div className="flex gap-2 text-sm font-medium text-neutral-500">
              <div className="w-56">Campaign ID</div>
              <div className="flex-1">Name</div>
              <div className="w-8" />
            </div>
          )}
          {rows.map((r) => (
            <div key={r.key} className="flex gap-2 items-center">
              <Input
                className="w-56"
                placeholder="24356000612"
                value={r.campaignId}
                status={
                  dups.includes(r.campaignId.trim()) ||
                  (incomplete.has(r.key) && !r.campaignId.trim())
                    ? 'error'
                    : undefined
                }
                disabled={saving}
                onChange={(e) => update(r.key, 'campaignId', e.target.value)}
              />
              <Input
                className="flex-1"
                placeholder="Product Search"
                status={incomplete.has(r.key) && !r.name.trim() ? 'error' : undefined}
                value={r.name}
                disabled={saving}
                onChange={(e) => update(r.key, 'name', e.target.value)}
              />
              <Button
                type="text"
                aria-label="Remove"
                icon={<Trash2 size={16} />}
                disabled={saving}
                onClick={() => remove(r.key)}
              />
            </div>
          ))}
          {incomplete.size > 0 && (
            <div className="text-red-500 text-sm">
              Each campaign needs both an ID and a name.
            </div>
          )}
          {dups.length > 0 && (
            <div className="text-red-500 text-sm">
              Listed twice: {dups.join(', ')}
            </div>
          )}
        </div>
      )}
    </PreferencesPage>
  );
}

export default withPageTitle('Campaign Names - OpenReplay Preferences')(
  CampaignNames,
);
