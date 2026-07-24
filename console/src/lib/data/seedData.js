// Mirrors supabase/seed.sql so the local-data mode and the Supabase mode show
// the same rows. Keep the two in sync when either changes.

export const ORG = {
  sportizo: '11111111-1111-4111-8111-000000000001',
  calirox: '11111111-1111-4111-8111-000000000002',
  demo: '11111111-1111-4111-8111-000000000003',
};

const V = {
  tennis: '22222222-2222-4222-8222-000000000001',
  badminton: '22222222-2222-4222-8222-000000000002',
  cricket: '22222222-2222-4222-8222-000000000003',
  pool: '22222222-2222-4222-8222-000000000004',
  sector56: '22222222-2222-4222-8222-000000000005',
  demoAcademy: '22222222-2222-4222-8222-000000000006',
};

const S = {
  caliroxBadminton: '33333333-3333-4333-8333-000000000001',
  caliroxBjj: '33333333-3333-4333-8333-000000000002',
  demoBadminton: '33333333-3333-4333-8333-000000000003',
  tennis: '33333333-3333-4333-8333-000000000004',
  badminton: '33333333-3333-4333-8333-000000000005',
  cricket: '33333333-3333-4333-8333-000000000006',
  swimming: '33333333-3333-4333-8333-000000000007',
};

export const seedData = {
  organisations: [
    {
      id: ORG.sportizo,
      name: 'Sportizo',
      subdomain: 'sportizo',
      domain: 'sportizo.playmetric.in',
      code: 'ORG-01',
      office_location: 'Sector 56',
      accent: 'cyan',
      is_active: true,
    },
    {
      id: ORG.calirox,
      name: 'Calirox',
      subdomain: 'CALIROXND',
      domain: 'calirox.playmetric.in',
      code: '1005',
      office_location: 'Sector 56, Gurgaon',
      accent: 'violet',
      is_active: true,
    },
    {
      id: ORG.demo,
      name: 'Demo',
      subdomain: 'demo',
      domain: 'demo.playmetric.in',
      code: 'ORG-0000',
      office_location: 'demo address',
      accent: 'blue',
      is_active: true,
    },
  ],

  venues: [
    { id: V.tennis, org_id: ORG.sportizo, name: 'Main Tennis Courts', location: 'Sector 56', is_active: true },
    { id: V.badminton, org_id: ORG.sportizo, name: 'Indoor Badminton', location: 'Sector 56', is_active: true },
    { id: V.cricket, org_id: ORG.sportizo, name: 'Cricket Nets', location: 'Sector 56', is_active: true },
    { id: V.pool, org_id: ORG.sportizo, name: 'Swimming Pool', location: 'Sector 56', is_active: true },
    { id: V.sector56, org_id: ORG.calirox, name: 'Sector 56', location: 'Sector 56, Gurgaon', is_active: true },
    { id: V.demoAcademy, org_id: ORG.demo, name: 'Badminton Academy', location: 'demo address', is_active: true },
  ],

  sports: [
    { id: S.caliroxBadminton, org_id: ORG.calirox, venue_id: V.sector56, name: 'Badminton', icon: 'racket', is_active: true },
    { id: S.caliroxBjj, org_id: ORG.calirox, venue_id: V.sector56, name: 'brazilian jiu jitsu', icon: 'martial', is_active: true },
    { id: S.demoBadminton, org_id: ORG.demo, venue_id: V.demoAcademy, name: 'Badminton', icon: 'racket', is_active: true },
    { id: S.tennis, org_id: ORG.sportizo, venue_id: V.tennis, name: 'Tennis', icon: 'racket', is_active: true },
    { id: S.badminton, org_id: ORG.sportizo, venue_id: V.badminton, name: 'Badminton', icon: 'racket', is_active: true },
    { id: S.cricket, org_id: ORG.sportizo, venue_id: V.cricket, name: 'Cricket', icon: 'cricket', is_active: true },
    { id: S.swimming, org_id: ORG.sportizo, venue_id: V.pool, name: 'Swimming', icon: 'swim', is_active: true },
  ],

  courts: [
    { id: '44444444-4444-4444-8444-000000000001', org_id: ORG.sportizo, venue_id: V.tennis, sport_id: S.tennis, name: 'Tennis Court 1', surface: 'Hard', capacity: 4, is_active: true },
    { id: '44444444-4444-4444-8444-000000000002', org_id: ORG.sportizo, venue_id: V.tennis, sport_id: S.tennis, name: 'Tennis Court 2', surface: 'Hard', capacity: 4, is_active: true },
    { id: '44444444-4444-4444-8444-000000000003', org_id: ORG.sportizo, venue_id: V.tennis, sport_id: S.tennis, name: 'Tennis Court 3', surface: 'Clay', capacity: 4, is_active: true },
    { id: '44444444-4444-4444-8444-000000000004', org_id: ORG.sportizo, venue_id: V.badminton, sport_id: S.badminton, name: 'Badminton Court 1', surface: 'Synthetic', capacity: 4, is_active: true },
    { id: '44444444-4444-4444-8444-000000000005', org_id: ORG.sportizo, venue_id: V.badminton, sport_id: S.badminton, name: 'Badminton Court 3', surface: 'Synthetic', capacity: 4, is_active: true },
    { id: '44444444-4444-4444-8444-000000000006', org_id: ORG.sportizo, venue_id: V.cricket, sport_id: S.cricket, name: 'Cricket Net 1', surface: 'Turf', capacity: 2, is_active: true },
    { id: '44444444-4444-4444-8444-000000000007', org_id: ORG.calirox, venue_id: V.sector56, sport_id: S.caliroxBadminton, name: 'Court A', surface: 'Synthetic', capacity: 4, is_active: true },
    { id: '44444444-4444-4444-8444-000000000008', org_id: ORG.demo, venue_id: V.demoAcademy, sport_id: S.demoBadminton, name: 'Demo Court 1', surface: 'Synthetic', capacity: 4, is_active: true },
  ],

  time_slots: [
    { id: '55555555-5555-4555-8555-000000000001', org_id: ORG.sportizo, label: 'Morning', start_time: '06:00', end_time: '09:00', days: [], is_active: true },
    { id: '55555555-5555-4555-8555-000000000002', org_id: ORG.sportizo, label: 'Midday', start_time: '12:00', end_time: '15:00', days: [], is_active: true },
    { id: '55555555-5555-4555-8555-000000000003', org_id: ORG.sportizo, label: 'Evening Peak', start_time: '17:00', end_time: '21:00', days: [], is_active: true },
    { id: '55555555-5555-4555-8555-000000000004', org_id: ORG.calirox, label: 'Morning', start_time: '06:30', end_time: '10:00', days: [], is_active: true },
    { id: '55555555-5555-4555-8555-000000000005', org_id: ORG.calirox, label: 'Evening', start_time: '18:00', end_time: '22:00', days: [], is_active: true },
    { id: '55555555-5555-4555-8555-000000000006', org_id: ORG.demo, label: 'All Day', start_time: '08:00', end_time: '20:00', days: [], is_active: true },
  ],
};
