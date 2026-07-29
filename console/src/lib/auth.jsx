import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';

const AuthContext = createContext(null);

// When running on local demo data there is no auth concept, so the whole app
// is treated as signed in. Supabase mode does the real thing.
const LOCAL_STAFF = {
  full_name: 'Local Demo',
  email: 'demo@playmetric.local',
  is_platform_admin: true,
};

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [staff, setStaff] = useState(isSupabaseConfigured ? null : LOCAL_STAFF);
  // 'loading' | 'signed-out' | 'no-staff-record' | 'ready'
  const [status, setStatus] = useState(isSupabaseConfigured ? 'loading' : 'ready');

  const loadStaff = useCallback(async (activeSession) => {
    if (!activeSession) {
      setStaff(null);
      setStatus('signed-out');
      return;
    }
    // The staff row is what RLS keys off. Auth alone isn't enough — a user
    // with no staff record legitimately sees nothing, so surface that clearly
    // instead of rendering an empty console.
    const { data, error } = await supabase
      .from('staff')
      .select('full_name, email, is_platform_admin')
      .eq('id', activeSession.user.id)
      .maybeSingle();

    if (error || !data) {
      setStaff(null);
      setStatus('no-staff-record');
      return;
    }
    setStaff(data);
    setStatus('ready');
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      loadStaff(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      loadStaff(next);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadStaff]);

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setStatus('signed-out');
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        staff,
        status,
        signIn,
        signOut,
        authEnabled: isSupabaseConfigured,
        // Platform admins (PlayMetric's own team) see every tenant; academy
        // owners are scoped to their own org(s). Screens use this to decide
        // whether to show cross-org pickers. RLS enforces the data boundary
        // regardless — this only shapes the UI. In local demo mode the stub
        // staff is a platform admin so every org is visible.
        isPlatformAdmin: Boolean(staff?.is_platform_admin),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
