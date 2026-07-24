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
};
