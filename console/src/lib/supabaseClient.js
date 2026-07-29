import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// `VITE_DATA_MODE=local` (set by `.env.demo`, loaded via `npm run demo`) forces
// the auth-free local demo even when Supabase keys are present in `.env.local`.
// This lets you flip between the seeded demo and the real backend without
// touching `.env.local`. `.env.local` never sets this key, so it can't override.
const forceLocal = import.meta.env.VITE_DATA_MODE === 'local';

export const isSupabaseConfigured = !forceLocal && Boolean(url && anonKey);

export const supabase = isSupabaseConfigured ? createClient(url, anonKey) : null;
