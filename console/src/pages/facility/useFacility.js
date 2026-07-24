import { useCallback, useEffect, useMemo, useState } from 'react';
import { data } from '../../lib/data';

// Loads every lookup the facility screens need (orgs, venues, sports) plus the
// rows for the active entity, and exposes one refresh for all of them.
export function useFacility(entity, orgId) {
  const [orgs, setOrgs] = useState([]);
  const [venues, setVenues] = useState([]);
  const [sports, setSports] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const filters = useMemo(() => (orgId ? { org_id: orgId } : {}), [orgId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Lookups are always unfiltered so dropdowns can offer every option.
      const [o, v, s, r] = await Promise.all([
        data.organisations.list(),
        data.venues.list(),
        data.sports.list(),
        data[entity].list(filters),
      ]);
      setOrgs(o);
      setVenues(v);
      setSports(s);
      setRows(r);
    } catch (err) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [entity, filters]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const byId = useMemo(
    () => ({
      org: Object.fromEntries(orgs.map((o) => [o.id, o])),
      venue: Object.fromEntries(venues.map((v) => [v.id, v])),
      sport: Object.fromEntries(sports.map((s) => [s.id, s])),
    }),
    [orgs, venues, sports]
  );

  return { orgs, venues, sports, rows, loading, error, refresh, byId };
}
