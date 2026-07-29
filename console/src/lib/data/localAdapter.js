// Local-data adapter: keeps the console fully usable before the Supabase
// project exists. State lives in localStorage so CRUD survives a reload.
// The method signatures match supabaseAdapter exactly, so swapping is a
// one-line change in ./index.js.

import { seedData } from './seedData';

const KEY = 'playmetric.console.v8';
const TABLES = [
  'organisations', 'venues', 'sports', 'courts', 'time_slots', 'bookings',
  'finance_entries', 'clients', 'contracts', 'reviews', 'tickets',
  'staff', 'org_members', 'actions', 'roles', 'role_permissions',
];

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Guard against a partially-written or outdated shape.
      if (TABLES.every((t) => Array.isArray(parsed[t]))) return parsed;
    }
  } catch {
    /* fall through to a fresh seed */
  }
  return structuredClone(seedData);
}

let db = load();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* storage full or blocked — keep working in memory */
  }
}

export function resetLocalData() {
  db = structuredClone(seedData);
  persist();
}

const delay = () => new Promise((r) => setTimeout(r, 60));

function matches(row, filters) {
  return Object.entries(filters).every(([k, v]) => v == null || row[k] === v);
}

function makeRepo(table, { sort } = {}) {
  return {
    async list(filters = {}) {
      await delay();
      const rows = db[table].filter((r) => matches(r, filters));
      return sort ? [...rows].sort(sort) : rows;
    },

    async create(payload) {
      await delay();
      const row = {
        id: crypto.randomUUID(),
        is_active: true,
        ...payload,
        created_at: new Date().toISOString(),
      };
      db[table] = [...db[table], row];
      persist();
      return row;
    },

    async update(id, patch) {
      await delay();
      let updated = null;
      db[table] = db[table].map((r) => {
        if (r.id !== id) return r;
        updated = { ...r, ...patch, updated_at: new Date().toISOString() };
        return updated;
      });
      persist();
      return updated;
    },

    async remove(id) {
      await delay();
      db[table] = db[table].filter((r) => r.id !== id);
      // Clean up children so the UI never shows orphaned rows. This mirrors the
      // Postgres FK rules (on delete cascade for org children; set null for the
      // nullable references a booking keeps).
      if (table === 'organisations') {
        for (const t of ['venues', 'sports', 'courts', 'time_slots', 'bookings', 'finance_entries', 'clients', 'contracts', 'reviews', 'tickets']) {
          db[t] = db[t].filter((r) => r.org_id !== id);
        }
      }
      if (table === 'venues') {
        const removedCourts = new Set(
          db.courts.filter((r) => r.venue_id === id).map((r) => r.id)
        );
        db.courts = db.courts.filter((r) => r.venue_id !== id);
        db.sports = db.sports.map((r) => (r.venue_id === id ? { ...r, venue_id: null } : r));
        db.bookings = db.bookings.map((r) =>
          r.venue_id === id || removedCourts.has(r.court_id)
            ? { ...r, venue_id: r.venue_id === id ? null : r.venue_id, court_id: removedCourts.has(r.court_id) ? null : r.court_id }
            : r
        );
        db.reviews = db.reviews.map((r) => (r.venue_id === id ? { ...r, venue_id: null } : r));
      }
      if (table === 'sports') {
        db.courts = db.courts.map((r) => (r.sport_id === id ? { ...r, sport_id: null } : r));
        db.bookings = db.bookings.map((r) => (r.sport_id === id ? { ...r, sport_id: null } : r));
        db.reviews = db.reviews.map((r) => (r.sport_id === id ? { ...r, sport_id: null } : r));
      }
      if (table === 'courts') {
        db.bookings = db.bookings.map((r) => (r.court_id === id ? { ...r, court_id: null } : r));
      }
      if (table === 'bookings') {
        // Mirror the FK's `on delete cascade`: drop finance rows this booking generated.
        db.finance_entries = db.finance_entries.filter((r) => r.booking_id !== id);
      }
      if (table === 'staff') {
        db.org_members = db.org_members.filter((r) => r.staff_id !== id);
      }
      if (table === 'roles') {
        db.role_permissions = db.role_permissions.filter((r) => r.role_id !== id);
      }
      if (table === 'actions') {
        // Cascade down the tree, then drop permissions pointing at the removed nodes.
        const doomed = new Set([id]);
        let grew = true;
        while (grew) {
          grew = false;
          for (const a of db.actions) {
            if (a.parent_id && doomed.has(a.parent_id) && !doomed.has(a.id)) {
              doomed.add(a.id);
              grew = true;
            }
          }
        }
        db.actions = db.actions.filter((r) => !doomed.has(r.id));
        db.role_permissions = db.role_permissions.filter((r) => !doomed.has(r.action_id));
      }
      if (table === 'clients') {
        db.contracts = db.contracts.map((r) => (r.client_id === id ? { ...r, client_id: null } : r));
        db.reviews = db.reviews.map((r) => (r.client_id === id ? { ...r, client_id: null } : r));
        db.tickets = db.tickets.map((r) => (r.client_id === id ? { ...r, client_id: null } : r));
      }
      persist();
    },
  };
}

const byName = (a, b) => a.name.localeCompare(b.name);

export const localAdapter = {
  mode: 'local',
  organisations: makeRepo('organisations', { sort: byName }),
  venues: makeRepo('venues', { sort: byName }),
  sports: makeRepo('sports', { sort: byName }),
  courts: makeRepo('courts', { sort: byName }),
  timeSlots: makeRepo('time_slots', {
    sort: (a, b) => a.start_time.localeCompare(b.start_time),
  }),
  bookings: makeRepo('bookings', {
    sort: (a, b) =>
      a.booking_date.localeCompare(b.booking_date) ||
      a.start_time.localeCompare(b.start_time),
  }),
  financeEntries: makeRepo('finance_entries', {
    // Newest first.
    sort: (a, b) =>
      b.entry_date.localeCompare(a.entry_date) ||
      (b.created_at || '').localeCompare(a.created_at || ''),
  }),
  clients: makeRepo('clients', { sort: byName }),
  contracts: makeRepo('contracts', {
    // Soonest-ending first so anything expiring surfaces at the top.
    sort: (a, b) => (a.end_date || '9999').localeCompare(b.end_date || '9999'),
  }),
  reviews: makeRepo('reviews', {
    // Newest first.
    sort: (a, b) => (b.review_date || '').localeCompare(a.review_date || ''),
  }),
  tickets: makeRepo('tickets', {
    // Oldest first within a column so the queue reads top-to-bottom.
    sort: (a, b) => (a.created_at || '').localeCompare(b.created_at || ''),
  }),

  /* ---- RBAC ---- */
  staff: makeRepo('staff', { sort: (a, b) => a.full_name.localeCompare(b.full_name) }),
  orgMembers: makeRepo('org_members'),
  actions: makeRepo('actions', { sort: (a, b) => a.sort_order - b.sort_order }),
  roles: makeRepo('roles', { sort: (a, b) => a.name.localeCompare(b.name) }),

  // Composite-keyed (role_id, action_id) — no surrogate id, so it gets a
  // purpose-built repo with an upsert instead of the generic create/update.
  rolePermissions: {
    async list(filters = {}) {
      await delay();
      return db.role_permissions.filter((r) => matches(r, filters));
    },
    async set({ role_id, action_id, allowed }) {
      await delay();
      const row = db.role_permissions.find(
        (r) => r.role_id === role_id && r.action_id === action_id
      );
      if (row) row.allowed = allowed;
      else db.role_permissions.push({ role_id, action_id, allowed });
      persist();
      return { role_id, action_id, allowed };
    },
    // Bulk variant so toggling a whole module is one write, not N.
    async setMany(rows) {
      await delay();
      for (const { role_id, action_id, allowed } of rows) {
        const row = db.role_permissions.find(
          (r) => r.role_id === role_id && r.action_id === action_id
        );
        if (row) row.allowed = allowed;
        else db.role_permissions.push({ role_id, action_id, allowed });
      }
      persist();
      return rows;
    },
  },
};
