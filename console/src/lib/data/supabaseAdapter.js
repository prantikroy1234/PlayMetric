// Supabase adapter. Activates automatically once VITE_SUPABASE_URL and
// VITE_SUPABASE_ANON_KEY are set. Same surface as localAdapter.
//
// Note there are no org_id filters hardcoded for safety here — RLS in
// supabase/migrations/0001_init.sql is what actually enforces tenant
// isolation. Filters below are for UI narrowing only.

import { supabase } from '../supabaseClient';

function makeRepo(table, { orderBy = 'name', ascending = true } = {}) {
  return {
    async list(filters = {}) {
      let q = supabase.from(table).select('*');
      for (const [k, v] of Object.entries(filters)) {
        if (v != null) q = q.eq(k, v);
      }
      const { data, error } = await q.order(orderBy, { ascending });
      if (error) throw error;
      return data ?? [];
    },

    async create(payload) {
      const { data, error } = await supabase.from(table).insert(payload).select().single();
      if (error) throw error;
      return data;
    },

    async update(id, patch) {
      const { data, error } = await supabase
        .from(table)
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async remove(id) {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
    },
  };
}

export const supabaseAdapter = {
  mode: 'supabase',
  organisations: makeRepo('organisations'),
  venues: makeRepo('venues'),
  sports: makeRepo('sports'),
  courts: makeRepo('courts'),
  timeSlots: makeRepo('time_slots', { orderBy: 'start_time' }),
  bookings: makeRepo('bookings', { orderBy: 'booking_date' }),
  financeEntries: makeRepo('finance_entries', { orderBy: 'entry_date', ascending: false }),
  clients: makeRepo('clients'),
  contracts: makeRepo('contracts', { orderBy: 'end_date' }),
  reviews: makeRepo('reviews', { orderBy: 'review_date', ascending: false }),
  tickets: makeRepo('tickets', { orderBy: 'created_at' }),

  /* ---- RBAC ---- */
  staff: makeRepo('staff', { orderBy: 'full_name' }),
  orgMembers: makeRepo('org_members', { orderBy: 'created_at' }),
  actions: makeRepo('actions', { orderBy: 'sort_order' }),
  roles: makeRepo('roles', { orderBy: 'name' }),

  // Composite-keyed (role_id, action_id): upsert on the compound key rather
  // than the generic id-based create/update.
  rolePermissions: {
    async list(filters = {}) {
      let q = supabase.from('role_permissions').select('*');
      for (const [k, v] of Object.entries(filters)) {
        if (v != null) q = q.eq(k, v);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    async set(row) {
      const { data, error } = await supabase
        .from('role_permissions')
        .upsert(row, { onConflict: 'role_id,action_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    async setMany(rows) {
      if (rows.length === 0) return [];
      const { data, error } = await supabase
        .from('role_permissions')
        .upsert(rows, { onConflict: 'role_id,action_id' })
        .select();
      if (error) throw error;
      return data ?? [];
    },
  },
};
