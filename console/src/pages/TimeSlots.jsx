import { useEffect, useState } from 'react';
import { data } from '../lib/data';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { PageHeader, Avatar, Chip, SearchInline } from '../components/ui';
import { IconPlus, IconBuilding } from '../components/Icons';
import { useFacility } from './facility/useFacility';
import EntityTable from './facility/EntityTable';
import { TimeSlotForm } from './facility/forms';
import { formatTime } from './Facility';

// Standalone Time Slots screen. Unlike the Sports Management tab, this one
// deliberately requires picking an organisation first — matching the live
// console, since timeslots are defined per organisation.
export default function TimeSlots() {
  const [orgId, setOrgId] = useState('');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const toast = useToast();
  const { isPlatformAdmin } = useAuth();

  const { orgs, rows, loading, refresh, byId } = useFacility('timeSlots', orgId);

  // Scoped academy owners skip the "pick an org first" step entirely — their
  // single org is auto-selected and the picker is hidden.
  const showOrgPicker = isPlatformAdmin || orgs.length > 1;
  useEffect(() => {
    if (!isPlatformAdmin && !orgId && orgs.length) setOrgId(orgs[0].id);
  }, [isPlatformAdmin, orgId, orgs]);

  async function save(form) {
    const { id, ...rest } = form;
    try {
      if (id) {
        await data.timeSlots.update(id, rest);
        toast('Changes saved');
      } else {
        await data.timeSlots.create(rest);
        toast('Timeslot created');
      }
      setEditing(null);
      refresh();
    } catch (err) {
      toast(err.message || 'Save failed', 'error');
    }
  }

  async function remove(row) {
    try {
      await data.timeSlots.remove(row.id);
      toast('Deleted');
      refresh();
    } catch (err) {
      toast(err.message || 'Delete failed', 'error');
    }
  }

  const columns = [
    {
      key: 'label',
      header: 'Slot',
      render: (r) => (
        <div className="cell-primary">
          <Avatar name={r.label} size="sm" />
          <span className="cell-title">{r.label}</span>
        </div>
      ),
    },
    {
      key: 'window',
      header: 'Interval',
      render: (r) => (
        <Chip variant="primary">
          {formatTime(r.start_time)} — {formatTime(r.end_time)}
        </Chip>
      ),
    },
    {
      key: 'org',
      header: 'Organisation',
      render: (r) => byId.org[r.org_id]?.name || '—',
    },
  ];

  return (
    <>
      <PageHeader
        title="Timeslot Configuration"
        subtitle="Manage and define global scheduling and booking intervals for organisations"
        actions={
          <button
            className="btn btn--primary"
            disabled={!orgId}
            title={orgId ? undefined : 'Select an organisation first'}
            onClick={() =>
              setEditing({ org_id: orgId, label: '', start_time: '', end_time: '', days: [] })
            }
          >
            <IconPlus width={16} height={16} /> Create Timeslot
          </button>
        }
      />

      <div className="toolbar">
        {showOrgPicker && (
          <select
            className="select-inline"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            aria-label="Organisation"
          >
            <option value="">Select One</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        )}
        {orgId && (
          <>
            <span className="toolbar__spacer" />
            <SearchInline value={query} onChange={setQuery} placeholder="Search timeslots…" />
          </>
        )}
      </div>

      {!orgId ? (
        <div className="card">
          <div className="empty">
            <div className="empty__icon">
              <IconBuilding width={24} height={24} />
            </div>
            <p className="empty__title">Please select an organisation to view timeslots.</p>
            <p className="empty__text">Timeslots are defined per organisation.</p>
          </div>
        </div>
      ) : (
        <EntityTable
          columns={columns}
          rows={rows}
          loading={loading}
          query={query}
          searchKeys={['label']}
          emptyTitle="No timeslots yet"
          emptyText="Define the intervals bookings can be made in."
          addLabel="Create Timeslot"
          deleteMessage="Bookings already made in this interval are not affected."
          onAdd={() =>
            setEditing({ org_id: orgId, label: '', start_time: '', end_time: '', days: [] })
          }
          onEdit={(row) => setEditing(row)}
          onDelete={remove}
        />
      )}

      {editing && (
        <TimeSlotForm
          initial={editing}
          orgs={orgs}
          lockedOrgId={orgId}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
