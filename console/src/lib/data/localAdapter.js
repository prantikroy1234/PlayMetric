// Local-data adapter: keeps the console fully usable before the Supabase
// project exists. State lives in localStorage so CRUD survives a reload.
// The method signatures match supabaseAdapter exactly, so swapping is a
// one-line change in ./index.js.

import { seedData } from './seedData';

const KEY = 'playmetric.console.v1';
const TABLES = ['organisations', 'venues', 'sports', 'courts', 'time_slots'];

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
      // Clean up children so the UI never shows orphaned rows.
      if (table === 'organisations') {
        for (const t of ['venues', 'sports', 'courts', 'time_slots']) {
          db[t] = db[t].filter((r) => r.org_id !== id);
        }
      }
      if (table === 'venues') {
        db.courts = db.courts.filter((r) => r.venue_id !== id);
        db.sports = db.sports.map((r) => (r.venue_id === id ? { ...r, venue_id: null } : r));
      }
      if (table === 'sports') {
        db.courts = db.courts.map((r) => (r.sport_id === id ? { ...r, sport_id: null } : r));
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
};
