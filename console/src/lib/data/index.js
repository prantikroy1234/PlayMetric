import { isSupabaseConfigured } from '../supabaseClient';
import { localAdapter } from './localAdapter';
import { supabaseAdapter } from './supabaseAdapter';

// One switch for the whole app. Set the two env vars and every screen
// starts talking to Postgres instead of localStorage — no screen changes.
export const data = isSupabaseConfigured ? supabaseAdapter : localAdapter;

export const dataMode = data.mode;
export { resetLocalData } from './localAdapter';
