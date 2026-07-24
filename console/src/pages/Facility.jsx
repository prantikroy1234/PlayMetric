import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { data } from '../lib/data';
import { useToast } from '../lib/toast';
import { PageHeader, Avatar, Chip, SearchInline } from '../components/ui';
import { IconPlus, IconPin, IconBuilding, IconBall, IconLayers, IconClock } from '../components/Icons';
import { useFacility } from './facility/useFacility';
import EntityTable, { OrgChip } from './facility/EntityTable';
import { VenueForm, SportForm, CourtForm, TimeSlotForm } from './facility/forms';

export const TABS = [
  { key: 'venues', label: 'Venues', entity: 'venues', icon: IconPin },
  { key: 'sports', label: 'Sports', entity: 'sports', icon: IconBall },
  { key: 'courts', label: 'Courts', entity: 'courts', icon: IconLayers },
  { key: 'time-slots', label: 'Time Slots', entity: 'timeSlots', icon: IconClock },
];

export function formatTime(t) {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

const COPY = {
  venues: {
    title: 'Venue Configuration',
    subtitle: 'Manage physical sites and their locations',
    add: 'Add Venue',
    emptyTitle: 'No venues yet',
    emptyText: 'Add a venue before configuring sports and courts.',
    deleteMessage: 'Courts at this venue are removed too, and any sport linked to it becomes unlinked.',
  },
  sports: {
    title: 'Sports Configuration',
    subtitle: 'Manage configured sports, booking schedules, and link them to venues',
    add: 'Add Sport',
    emptyTitle: 'No sports configured',
    emptyText: 'Add a sport to start scheduling sessions.',
    deleteMessage: 'Courts using this sport will have their sport cleared.',
  },
  courts: {
    title: 'Court Configuration',
    subtitle: 'Manage bookable surfaces inside each venue',
    add: 'Add Court',
    emptyTitle: 'No courts yet',
    emptyText: 'Courts are what bookings are made against — add your first one.',
    deleteMessage: 'This court will no longer be bookable.',
  },
  'time-slots': {
    title: 'Timeslot Configuration',
    subtitle: 'Manage and define global scheduling and booking intervals for organisations',
    add: 'Create Timeslot',
    emptyTitle: 'No timeslots yet',
    emptyText: 'Define the intervals bookings can be made in.',
    deleteMessage: 'Bookings already made in this interval are not affected.',
  },
};

export default function Facility() {
  const [params, setParams] = useSearchParams();
  const tabKey = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'venues';
  const tab = TABS.find((t) => t.key === tabKey);

  const [orgId, setOrgId] = useState('');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const toast = useToast();

  const { orgs, venues, sports, rows, loading, refresh, byId } = useFacility(tab.entity, orgId);
  const copy = COPY[tabKey];

  const blank = useMemo(
    () => ({
      venues: { org_id: orgId || '', name: '', location: '' },
      sports: { org_id: orgId || '', name: '', venue_id: '', icon: 'racket' },
      courts: { org_id: orgId || '', venue_id: '', sport_id: '', name: '', surface: '', capacity: '' },
      'time-slots': { org_id: orgId || '', label: '', start_time: '', end_time: '', days: [] },
    }),
    [orgId]
  );

  const columns = {
    venues: [
      {
        key: 'name',
        header: 'Venue',
        render: (r) => (
          <div className="cell-primary">
            <Avatar name={r.name} size="sm" />
            <span className="cell-title">{r.name}</span>
          </div>
        ),
      },
      { key: 'org', header: 'Organisation', render: (r) => <OrgChip org={byId.org[r.org_id]} /> },
      { key: 'location', header: 'Location', render: (r) => r.location || '—' },
    ],
    sports: [
      {
        key: 'name',
        header: 'Sport',
        render: (r) => (
          <div className="cell-primary">
            <Avatar name={r.name} size="sm" />
            <span className="cell-title">{r.name}</span>
          </div>
        ),
      },
      { key: 'org', header: 'Organisation', render: (r) => <OrgChip org={byId.org[r.org_id]} /> },
      {
        key: 'venue',
        header: 'Venue / Location',
        render: (r) => {
          const v = byId.venue[r.venue_id];
          return v ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <IconPin width={14} height={14} style={{ color: 'var(--ink-faint)' }} />
              {v.name}
            </span>
          ) : (
            <span style={{ color: 'var(--ink-faint)' }}>Not linked</span>
          );
        },
      },
    ],
    courts: [
      {
        key: 'name',
        header: 'Court',
        render: (r) => (
          <div className="cell-primary">
            <Avatar name={r.name} size="sm" />
            <div>
              <div className="cell-title">{r.name}</div>
              {r.capacity ? <div className="cell-sub">Capacity {r.capacity}</div> : null}
            </div>
          </div>
        ),
      },
      { key: 'org', header: 'Organisation', render: (r) => <OrgChip org={byId.org[r.org_id]} /> },
      { key: 'venue', header: 'Venue', render: (r) => byId.venue[r.venue_id]?.name || '—' },
      {
        key: 'sport',
        header: 'Sport',
        render: (r) =>
          byId.sport[r.sport_id] ? <Chip>{byId.sport[r.sport_id].name}</Chip> : '—',
      },
      { key: 'surface', header: 'Surface', render: (r) => r.surface || '—' },
    ],
    'time-slots': [
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
      { key: 'org', header: 'Organisation', render: (r) => <OrgChip org={byId.org[r.org_id]} /> },
      {
        key: 'window',
        header: 'Interval',
        render: (r) => (
          <Chip variant="primary">
            {formatTime(r.start_time)} — {formatTime(r.end_time)}
          </Chip>
        ),
      },
    ],
  }[tabKey];

  const searchKeys = {
    venues: ['name', 'location'],
    sports: ['name'],
    courts: ['name', 'surface'],
    'time-slots': ['label'],
  }[tabKey];

  async function save(form) {
    // Normalise empty selects to null so FK columns stay valid in Postgres.
    const payload = { ...form };
    for (const k of ['venue_id', 'sport_id']) {
      if (k in payload && !payload[k]) payload[k] = null;
    }
    if ('capacity' in payload) {
      payload.capacity = payload.capacity === '' ? null : Number(payload.capacity);
    }
    const { id, ...rest } = payload;
    try {
      if (id) {
        await data[tab.entity].update(id, rest);
        toast('Changes saved');
      } else {
        await data[tab.entity].create(rest);
        toast('Created');
      }
      setEditing(null);
      refresh();
    } catch (err) {
      toast(err.message || 'Save failed', 'error');
    }
  }

  async function remove(row) {
    try {
      await data[tab.entity].remove(row.id);
      toast('Deleted');
      refresh();
    } catch (err) {
      toast(err.message || 'Delete failed', 'error');
    }
  }

  const formProps = {
    orgs,
    venues,
    sports,
    lockedOrgId: orgId || null,
    onSave: save,
    onClose: () => setEditing(null),
  };

  return (
    <>
      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab${t.key === tabKey ? ' is-active' : ''}`}
            onClick={() => {
              setParams({ tab: t.key });
              setQuery('');
            }}
          >
            <t.icon width={16} height={16} />
            {t.label}
          </button>
        ))}
      </div>

      <PageHeader
        title={copy.title}
        subtitle={copy.subtitle}
        actions={
          <button className="btn btn--primary" onClick={() => setEditing(blank[tabKey])}>
            <IconPlus width={16} height={16} /> {copy.add}
          </button>
        }
      />

      <div className="toolbar">
        <select
          className="select-inline"
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
          aria-label="Filter by organisation"
        >
          <option value="">All Organisations</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <span className="toolbar__spacer" />
        <SearchInline value={query} onChange={setQuery} placeholder={`Search ${tab.label.toLowerCase()}…`} />
      </div>

      {orgs.length === 0 && !loading ? (
        <div className="card">
          <div className="empty">
            <div className="empty__icon">
              <IconBuilding width={24} height={24} />
            </div>
            <p className="empty__title">No organisations yet</p>
            <p className="empty__text">
              Facility configuration hangs off an organisation. Create one under Academy first.
            </p>
          </div>
        </div>
      ) : (
        <EntityTable
          columns={columns}
          rows={rows}
          loading={loading}
          query={query}
          searchKeys={searchKeys}
          emptyTitle={copy.emptyTitle}
          emptyText={copy.emptyText}
          addLabel={copy.add}
          deleteMessage={copy.deleteMessage}
          onAdd={() => setEditing(blank[tabKey])}
          onEdit={(row) => setEditing(row)}
          onDelete={remove}
        />
      )}

      {editing && tabKey === 'venues' && <VenueForm initial={editing} {...formProps} />}
      {editing && tabKey === 'sports' && <SportForm initial={editing} {...formProps} />}
      {editing && tabKey === 'courts' && <CourtForm initial={editing} {...formProps} />}
      {editing && tabKey === 'time-slots' && <TimeSlotForm initial={editing} {...formProps} />}
    </>
  );
}
