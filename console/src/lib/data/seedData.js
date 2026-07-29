// Mirrors supabase/seed.sql so the local-data mode and the Supabase mode show
// the same rows. Keep the two in sync when either changes.
//
// NOTE: `staff` / `org_members` are seeded HERE ONLY. In Supabase, staff.id is
// a FK to auth.users, so staff rows can't be seeded by SQL — they appear when
// people actually sign up. Local demo mode has no auth, so free rows are fine.

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

const C = {
  tennis1: '44444444-4444-4444-8444-000000000001',
  tennis2: '44444444-4444-4444-8444-000000000002',
  tennis3: '44444444-4444-4444-8444-000000000003',
  badminton1: '44444444-4444-4444-8444-000000000004',
  badminton3: '44444444-4444-4444-8444-000000000005',
  cricket1: '44444444-4444-4444-8444-000000000006',
  caliroxA: '44444444-4444-4444-8444-000000000007',
  demo1: '44444444-4444-4444-8444-000000000008',
};

// Demo bookings are anchored to "today" (built from local date parts, not UTC,
// so the day never slips) so the calendar always looks populated on first run.
// Supabase's seed.sql anchors the same rows with current_date + n.
function dayOffset(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/* --------------------------- RBAC seed data ---------------------------- */
// The 4-level capability catalogue: Subsystem → Module → Submodule → Action.
// Written as a compact tree and flattened below so ids stay deterministic.
// Shape: [name, children] … leaves are [code, name].
const ACTION_TREE = [
  ['CRM', [
    ['Dashboard', [
      ['Overview', [['ac-101', 'View dashboard']]],
    ]],
    ['Booking Management', [
      ['Calendar', [
        ['ac-201', 'View calendar'], ['ac-202', 'Create booking'],
        ['ac-203', 'Edit booking'], ['ac-204', 'Cancel booking'],
      ]],
      ['Transactions', [['ac-205', 'View transactions'], ['ac-206', 'Export transactions']]],
    ]],
    ['Financial Management', [
      ['Overview', [['ac-301', 'View financial overview']]],
      ['Ledger', [
        ['ac-302', 'View ledger'], ['ac-303', 'Add entry'],
        ['ac-304', 'Edit entry'], ['ac-305', 'Export CSV'],
      ]],
    ]],
    ['Configuration', [
      ['Academy', [['ac-401', 'View academy'], ['ac-402', 'Edit academy']]],
      ['Facility', [
        ['ac-403', 'Manage venues'], ['ac-404', 'Manage courts'],
        ['ac-405', 'Manage sports'], ['ac-406', 'Manage time slots'],
      ]],
    ]],
    ['Operations', [
      ['Clients', [['ac-501', 'View clients'], ['ac-502', 'Manage clients']]],
      ['Contracts', [['ac-503', 'View contracts'], ['ac-504', 'Manage contracts']]],
    ]],
    ['Insights & Support', [
      ['Analytics', [['ac-601', 'View analytics']]],
      ['Reviews', [['ac-602', 'View reviews'], ['ac-603', 'Manage reviews']]],
      ['Tickets', [['ac-604', 'View tickets'], ['ac-605', 'Manage tickets']]],
    ]],
    ['Permissions', [
      ['Users', [['ac-701', 'View users'], ['ac-702', 'Manage users']]],
      ['Roles', [['ac-703', 'View roles'], ['ac-704', 'Manage roles']]],
      ['Actions', [['ac-705', 'View actions'], ['ac-706', 'Manage actions']]],
    ]],
  ]],
];

const actionId = (n) => `eeeeeeee-eeee-4eee-8eee-${String(n).padStart(12, '0')}`;

function flattenActions() {
  const rows = [];
  let n = 0;
  const push = (level, name, parent_id, code = null) => {
    const row = {
      id: actionId(++n), parent_id, level, code, name,
      description: null, sort_order: rows.filter((r) => r.parent_id === parent_id).length,
      is_active: true,
    };
    rows.push(row);
    return row.id;
  };
  for (const [subsystem, modules] of ACTION_TREE) {
    const sid = push('subsystem', subsystem, null);
    for (const [module, submodules] of modules) {
      const mid = push('module', module, sid);
      for (const [submodule, leaves] of submodules) {
        const subId = push('submodule', submodule, mid);
        for (const [code, name] of leaves) push('action', name, subId, code);
      }
    }
  }
  return rows;
}

const ACTIONS = flattenActions();

const ROLE_DEFS = [
  ['owner', 'Owner', 'Full access, including permissions'],
  ['manager', 'Manager', 'Day-to-day operations; cannot change permissions'],
  ['front_desk', 'Front Desk', 'Bookings, clients, and support tickets'],
  ['accountant', 'Accountant', 'Financial records and contracts'],
  ['coach', 'Coach', 'Read-only schedule and feedback'],
];

const ROLES = ROLE_DEFS.map(([key, name, description], i) => ({
  id: `dddddddd-dddd-4ddd-8ddd-${String(i + 1).padStart(12, '0')}`,
  org_id: null, // system templates, shared by every tenant
  key, name, description, is_system: true,
}));

// Which action codes each system role is allowed. Kept as predicates so the
// matrix stays readable and survives new action codes being added.
const ROLE_GRANTS = {
  owner: () => true,
  manager: (c) => !c.startsWith('ac-7'),
  front_desk: (c) =>
    ['ac-101', 'ac-201', 'ac-202', 'ac-203', 'ac-204', 'ac-205', 'ac-501', 'ac-502', 'ac-604', 'ac-605'].includes(c),
  accountant: (c) =>
    ['ac-101', 'ac-205', 'ac-206', 'ac-301', 'ac-302', 'ac-303', 'ac-304', 'ac-305', 'ac-503', 'ac-504'].includes(c),
  coach: (c) => ['ac-101', 'ac-201', 'ac-602'].includes(c),
};

const ROLE_PERMISSIONS = ROLES.flatMap((role) =>
  ACTIONS.filter((a) => a.level === 'action').map((a) => ({
    role_id: role.id,
    action_id: a.id,
    allowed: Boolean(ROLE_GRANTS[role.key]?.(a.code)),
  }))
);

// Demo staff. Local mode only (see the note at the top of this file).
const STAFF = [
  { id: 'cccccccc-cccc-4ccc-8ccc-000000000001', full_name: 'Vivek Tushir', email: 'vivek@playmetric.in', phone: '98100 10001', employee_code: 'PM-001', department: 'Platform', is_platform_admin: true },
  { id: 'cccccccc-cccc-4ccc-8ccc-000000000002', full_name: 'Ravi Kumar', email: 'ravi@sportizo.in', phone: '98110 10002', employee_code: 'SPZ-01', department: 'Operations', is_platform_admin: false },
  { id: 'cccccccc-cccc-4ccc-8ccc-000000000003', full_name: 'Anjali Sharma', email: 'anjali@sportizo.in', phone: '98110 10003', employee_code: 'SPZ-02', department: 'Front Desk', is_platform_admin: false },
  { id: 'cccccccc-cccc-4ccc-8ccc-000000000004', full_name: 'Nikhil Bose', email: 'nikhil@sportizo.in', phone: '98110 10004', employee_code: 'SPZ-03', department: 'Finance', is_platform_admin: false },
  { id: 'cccccccc-cccc-4ccc-8ccc-000000000005', full_name: 'Rohit Verma', email: 'rohit@calirox.in', phone: '99870 10005', employee_code: 'CLX-01', department: 'Management', is_platform_admin: false },
  { id: 'cccccccc-cccc-4ccc-8ccc-000000000006', full_name: 'Demo Owner', email: 'owner@demo.in', phone: '90000 10006', employee_code: 'DMO-01', department: 'Management', is_platform_admin: false },
];

const ORG_MEMBERS = [
  { id: 'ffffffff-ffff-4fff-8fff-000000000001', org_id: ORG.sportizo, staff_id: STAFF[1].id, role_key: 'manager' },
  { id: 'ffffffff-ffff-4fff-8fff-000000000002', org_id: ORG.sportizo, staff_id: STAFF[2].id, role_key: 'front_desk' },
  { id: 'ffffffff-ffff-4fff-8fff-000000000003', org_id: ORG.sportizo, staff_id: STAFF[3].id, role_key: 'accountant' },
  { id: 'ffffffff-ffff-4fff-8fff-000000000004', org_id: ORG.calirox, staff_id: STAFF[4].id, role_key: 'owner' },
  { id: 'ffffffff-ffff-4fff-8fff-000000000005', org_id: ORG.demo, staff_id: STAFF[5].id, role_key: 'owner' },
];

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

  bookings: [
    // Sportizo — spread across this week and its courts.
    { id: '66666666-6666-4666-8666-000000000001', org_id: ORG.sportizo, venue_id: V.tennis, court_id: C.tennis1, sport_id: S.tennis, booking_date: dayOffset(0), start_time: '07:00', end_time: '08:00', client_name: 'Rahul Sharma', client_phone: '98110 22001', status: 'confirmed', amount: 600, source: 'manual', notes: '' },
    { id: '66666666-6666-4666-8666-000000000002', org_id: ORG.sportizo, venue_id: V.badminton, court_id: C.badminton1, sport_id: S.badminton, booking_date: dayOffset(0), start_time: '18:00', end_time: '19:00', client_name: 'Priya Nair', client_phone: '98110 22002', status: 'confirmed', amount: 500, source: 'manual', notes: '' },
    { id: '66666666-6666-4666-8666-000000000003', org_id: ORG.sportizo, venue_id: V.cricket, court_id: C.cricket1, sport_id: S.cricket, booking_date: dayOffset(0), start_time: '17:00', end_time: '18:30', client_name: 'Arjun Mehta', client_phone: '98110 22003', status: 'pending', amount: 900, source: 'manual', notes: 'Net practice, 6 players' },
    { id: '66666666-6666-4666-8666-000000000004', org_id: ORG.sportizo, venue_id: V.tennis, court_id: C.tennis2, sport_id: S.tennis, booking_date: dayOffset(1), start_time: '06:00', end_time: '07:00', client_name: 'Karan Singh', client_phone: '98110 22004', status: 'confirmed', amount: 600, source: 'manual', notes: '' },
    { id: '66666666-6666-4666-8666-000000000005', org_id: ORG.sportizo, venue_id: V.badminton, court_id: C.badminton3, sport_id: S.badminton, booking_date: dayOffset(1), start_time: '19:00', end_time: '20:00', client_name: 'Sneha Rao', client_phone: '98110 22005', status: 'confirmed', amount: 500, source: 'manual', notes: '' },
    { id: '66666666-6666-4666-8666-000000000006', org_id: ORG.sportizo, venue_id: V.tennis, court_id: C.tennis3, sport_id: S.tennis, booking_date: dayOffset(2), start_time: '08:00', end_time: '09:00', client_name: 'Vikram Patel', client_phone: '98110 22006', status: 'confirmed', amount: 700, source: 'manual', notes: '' },
    { id: '66666666-6666-4666-8666-000000000007', org_id: ORG.sportizo, venue_id: V.cricket, court_id: C.cricket1, sport_id: S.cricket, booking_date: dayOffset(2), start_time: '16:00', end_time: '17:00', client_name: 'Team Titans', client_phone: '98110 22007', status: 'confirmed', amount: 1200, source: 'manual', notes: '' },
    { id: '66666666-6666-4666-8666-000000000008', org_id: ORG.sportizo, venue_id: V.badminton, court_id: C.badminton1, sport_id: S.badminton, booking_date: dayOffset(-1), start_time: '20:00', end_time: '21:00', client_name: 'Ananya Gupta', client_phone: '98110 22008', status: 'completed', amount: 500, source: 'manual', notes: '' },
    { id: '66666666-6666-4666-8666-000000000009', org_id: ORG.sportizo, venue_id: V.tennis, court_id: C.tennis1, sport_id: S.tennis, booking_date: dayOffset(3), start_time: '09:00', end_time: '10:00', client_name: 'Rohan Das', client_phone: '98110 22009', status: 'cancelled', amount: 600, source: 'manual', notes: 'Client rescheduled' },
    // Calirox
    { id: '66666666-6666-4666-8666-000000000010', org_id: ORG.calirox, venue_id: V.sector56, court_id: C.caliroxA, sport_id: S.caliroxBadminton, booking_date: dayOffset(0), start_time: '07:00', end_time: '08:00', client_name: 'Meera Iyer', client_phone: '99870 33001', status: 'confirmed', amount: 550, source: 'manual', notes: '' },
    { id: '66666666-6666-4666-8666-000000000011', org_id: ORG.calirox, venue_id: V.sector56, court_id: C.caliroxA, sport_id: S.caliroxBadminton, booking_date: dayOffset(1), start_time: '18:30', end_time: '19:30', client_name: 'Sameer Khan', client_phone: '99870 33002', status: 'pending', amount: 550, source: 'manual', notes: '' },
    // Demo
    { id: '66666666-6666-4666-8666-000000000012', org_id: ORG.demo, venue_id: V.demoAcademy, court_id: C.demo1, sport_id: S.demoBadminton, booking_date: dayOffset(0), start_time: '10:00', end_time: '11:00', client_name: 'Demo Client', client_phone: '90000 00000', status: 'confirmed', amount: 400, source: 'manual', notes: '' },
    // Extra past sessions (give a few clients repeat visits so LTV varies)
    { id: '66666666-6666-4666-8666-000000000013', org_id: ORG.sportizo, venue_id: V.tennis, court_id: C.tennis2, sport_id: S.tennis, booking_date: dayOffset(-3), start_time: '07:00', end_time: '08:00', client_name: 'Rahul Sharma', client_phone: '98110 22001', status: 'completed', amount: 600, source: 'manual', notes: '' },
    { id: '66666666-6666-4666-8666-000000000014', org_id: ORG.sportizo, venue_id: V.cricket, court_id: C.cricket1, sport_id: S.cricket, booking_date: dayOffset(-5), start_time: '16:00', end_time: '17:30', client_name: 'Team Titans', client_phone: '98110 22007', status: 'completed', amount: 1500, source: 'manual', notes: '' },
    { id: '66666666-6666-4666-8666-000000000015', org_id: ORG.sportizo, venue_id: V.badminton, court_id: C.badminton3, sport_id: S.badminton, booking_date: dayOffset(-4), start_time: '18:00', end_time: '19:00', client_name: 'Priya Nair', client_phone: '98110 22002', status: 'completed', amount: 500, source: 'manual', notes: '' },
  ],

  finance_entries: [
    // Sportizo — inflow
    { id: '77777777-7777-4777-8777-000000000001', org_id: ORG.sportizo, direction: 'inflow',  category: 'Bookings',   label: 'Court bookings — week collection', amount: 42500, entry_date: dayOffset(-2),  method: 'UPI',           source: 'manual', notes: '' },
    { id: '77777777-7777-4777-8777-000000000002', org_id: ORG.sportizo, direction: 'inflow',  category: 'Membership', label: 'Monthly membership renewals',       amount: 68000, entry_date: dayOffset(-6),  method: 'Bank Transfer', source: 'manual', notes: '' },
    { id: '77777777-7777-4777-8777-000000000003', org_id: ORG.sportizo, direction: 'inflow',  category: 'Coaching',   label: 'Summer tennis camp fees',          amount: 35000, entry_date: dayOffset(-10), method: 'Card',          source: 'manual', notes: '18 kids' },
    { id: '77777777-7777-4777-8777-000000000004', org_id: ORG.sportizo, direction: 'inflow',  category: 'Events',     label: 'Corporate cricket tournament',     amount: 25000, entry_date: dayOffset(-14), method: 'Bank Transfer', source: 'manual', notes: '' },
    // Sportizo — outflow
    { id: '77777777-7777-4777-8777-000000000005', org_id: ORG.sportizo, direction: 'outflow', category: 'Rent',       label: 'Venue rent — Sector 56',           amount: 55000, entry_date: dayOffset(-5),  method: 'Bank Transfer', source: 'manual', notes: '' },
    { id: '77777777-7777-4777-8777-000000000006', org_id: ORG.sportizo, direction: 'outflow', category: 'Salaries',   label: 'Coaching + ground staff payroll',  amount: 82000, entry_date: dayOffset(-4),  method: 'Bank Transfer', source: 'manual', notes: '' },
    { id: '77777777-7777-4777-8777-000000000007', org_id: ORG.sportizo, direction: 'outflow', category: 'Utilities',  label: 'Electricity + water',              amount: 14500, entry_date: dayOffset(-7),  method: 'UPI',           source: 'manual', notes: '' },
    { id: '77777777-7777-4777-8777-000000000008', org_id: ORG.sportizo, direction: 'outflow', category: 'Equipment',  label: 'Tennis balls + net replacements',  amount: 9800,  entry_date: dayOffset(-9),  method: 'Cash',          source: 'manual', notes: '' },
    { id: '77777777-7777-4777-8777-000000000009', org_id: ORG.sportizo, direction: 'outflow', category: 'Maintenance',label: 'Court resurfacing (Court 3)',      amount: 18000, entry_date: dayOffset(-16), method: 'UPI',           source: 'manual', notes: '' },
    { id: '77777777-7777-4777-8777-000000000010', org_id: ORG.sportizo, direction: 'outflow', category: 'Marketing',  label: 'Instagram ads + flyers',           amount: 6500,  entry_date: dayOffset(-12), method: 'Card',          source: 'manual', notes: '' },
    // Calirox
    { id: '77777777-7777-4777-8777-000000000011', org_id: ORG.calirox,  direction: 'inflow',  category: 'Bookings',   label: 'Badminton court collections',      amount: 21000, entry_date: dayOffset(-3),  method: 'UPI',           source: 'manual', notes: '' },
    { id: '77777777-7777-4777-8777-000000000012', org_id: ORG.calirox,  direction: 'outflow', category: 'Salaries',   label: 'Coach payouts',                    amount: 28000, entry_date: dayOffset(-5),  method: 'Bank Transfer', source: 'manual', notes: '' },
    { id: '77777777-7777-4777-8777-000000000013', org_id: ORG.calirox,  direction: 'outflow', category: 'Utilities',  label: 'Electricity',                      amount: 7200,  entry_date: dayOffset(-8),  method: 'UPI',           source: 'manual', notes: '' },
    // Demo
    { id: '77777777-7777-4777-8777-000000000014', org_id: ORG.demo,     direction: 'inflow',  category: 'Bookings',   label: 'Demo court bookings',              amount: 4800,  entry_date: dayOffset(-1),  method: 'Cash',          source: 'manual', notes: '' },
    { id: '77777777-7777-4777-8777-000000000015', org_id: ORG.demo,     direction: 'outflow', category: 'Equipment',  label: 'Shuttlecocks',                     amount: 1500,  entry_date: dayOffset(-4),  method: 'Cash',          source: 'manual', notes: '' },
  ],

  clients: [
    // Names mirror booking client_names so the directory's LTV/booking counts
    // resolve by name (see 0006_clients.sql). Sportizo has the fullest roster.
    { id: '88888888-8888-4888-8888-000000000001', org_id: ORG.sportizo, name: 'Rahul Sharma', phone: '98110 22001', email: 'rahul.sharma@example.com', type: 'individual', notes: '' },
    { id: '88888888-8888-4888-8888-000000000002', org_id: ORG.sportizo, name: 'Priya Nair',   phone: '98110 22002', email: 'priya.nair@example.com',   type: 'individual', notes: '' },
    { id: '88888888-8888-4888-8888-000000000003', org_id: ORG.sportizo, name: 'Arjun Mehta',  phone: '98110 22003', email: 'arjun.mehta@example.com',  type: 'individual', notes: '' },
    { id: '88888888-8888-4888-8888-000000000004', org_id: ORG.sportizo, name: 'Karan Singh',  phone: '98110 22004', email: 'karan.singh@example.com',  type: 'individual', notes: '' },
    { id: '88888888-8888-4888-8888-000000000005', org_id: ORG.sportizo, name: 'Team Titans',  phone: '98110 22007', email: 'captain@teamtitans.in',    type: 'team',       notes: 'Corporate cricket league side' },
    { id: '88888888-8888-4888-8888-000000000006', org_id: ORG.sportizo, name: 'Ananya Gupta', phone: '98110 22008', email: 'ananya.g@example.com',     type: 'individual', notes: '' },
    // Calirox
    { id: '88888888-8888-4888-8888-000000000007', org_id: ORG.calirox,  name: 'Meera Iyer',   phone: '99870 33001', email: 'meera.iyer@example.com',   type: 'individual', notes: '' },
    { id: '88888888-8888-4888-8888-000000000008', org_id: ORG.calirox,  name: 'Sameer Khan',  phone: '99870 33002', email: 'sameer.khan@example.com',  type: 'individual', notes: '' },
    // Demo
    { id: '88888888-8888-4888-8888-000000000009', org_id: ORG.demo,     name: 'Demo Client',  phone: '90000 00000', email: 'demo@example.com',         type: 'corporate', notes: 'Sample corporate account' },
  ],

  contracts: [
    // Sportizo — the fullest set; dates anchored so one is expiring soon and
    // one is already expired (drives the console's status hints).
    { id: '99999999-9999-4999-8999-000000000001', org_id: ORG.sportizo, client_id: null, title: 'Venue Lease — Sector 56', counterparty: 'Sector 56 Realty', type: 'lease', status: 'active', start_date: dayOffset(-320), end_date: dayOffset(45), value: 660000, notes: 'Annual lease, renews yearly' },
    { id: '99999999-9999-4999-8999-000000000002', org_id: ORG.sportizo, client_id: null, title: 'Coaching Services Agreement', counterparty: 'Elite Coaching LLP', type: 'service', status: 'active', start_date: dayOffset(-120), end_date: dayOffset(240), value: 180000, notes: '' },
    { id: '99999999-9999-4999-8999-000000000003', org_id: ORG.sportizo, client_id: null, title: 'Beverage Sponsorship', counterparty: 'HydraFuel Sports Drinks', type: 'sponsorship', status: 'active', start_date: dayOffset(-60), end_date: dayOffset(20), value: 90000, notes: 'Signage + sampling rights' },
    { id: '99999999-9999-4999-8999-000000000004', org_id: ORG.sportizo, client_id: '88888888-8888-4888-8888-000000000005', title: 'Corporate Membership — Team Titans', counterparty: 'Team Titans', type: 'membership', status: 'active', start_date: dayOffset(-30), end_date: dayOffset(335), value: 120000, notes: 'Priority cricket nets' },
    { id: '99999999-9999-4999-8999-000000000005', org_id: ORG.sportizo, client_id: null, title: 'Grounds Maintenance (2025)', counterparty: 'GreenTurf Services', type: 'service', status: 'expired', start_date: dayOffset(-400), end_date: dayOffset(-35), value: 75000, notes: '' },
    // Calirox
    { id: '99999999-9999-4999-8999-000000000006', org_id: ORG.calirox, client_id: null, title: 'Venue Lease — Gurgaon', counterparty: 'Gurgaon Estates', type: 'lease', status: 'active', start_date: dayOffset(-200), end_date: dayOffset(150), value: 420000, notes: '' },
    { id: '99999999-9999-4999-8999-000000000007', org_id: ORG.calirox, client_id: null, title: 'Annual Membership Plan', counterparty: 'Calirox Members Pool', type: 'membership', status: 'draft', start_date: dayOffset(10), end_date: dayOffset(375), value: 0, notes: 'Pending sign-off' },
    // Demo
    { id: '99999999-9999-4999-8999-000000000008', org_id: ORG.demo, client_id: null, title: 'Trial Service Agreement', counterparty: 'Demo Vendor', type: 'service', status: 'draft', start_date: dayOffset(0), end_date: dayOffset(90), value: 5000, notes: '' },
  ],

  reviews: [
    // Sportizo — client_ids/venues/sports mirror the other seed tables.
    { id: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001', org_id: ORG.sportizo, client_id: '88888888-8888-4888-8888-000000000001', venue_id: V.tennis, sport_id: S.tennis, rating: 5, title: 'Superb tennis courts', body: 'Well-maintained hard courts and easy online booking. My go-to spot.', author_name: 'Rahul Sharma', status: 'published', review_date: dayOffset(-3) },
    { id: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000002', org_id: ORG.sportizo, client_id: '88888888-8888-4888-8888-000000000002', venue_id: V.badminton, sport_id: S.badminton, rating: 4, title: 'Good badminton facility', body: 'Nice synthetic courts. Evenings get busy so book ahead.', author_name: 'Priya Nair', status: 'published', review_date: dayOffset(-6) },
    { id: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000003', org_id: ORG.sportizo, client_id: '88888888-8888-4888-8888-000000000003', venue_id: V.cricket, sport_id: S.cricket, rating: 3, title: 'Nets are okay', body: 'Practice nets do the job but could use fresh matting.', author_name: 'Arjun Mehta', status: 'published', review_date: dayOffset(-9) },
    { id: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000004', org_id: ORG.sportizo, client_id: '88888888-8888-4888-8888-000000000004', venue_id: V.tennis, sport_id: S.tennis, rating: 5, title: 'Great coaching', body: 'Coaches are attentive and the courts are always ready on time.', author_name: 'Karan Singh', status: 'published', review_date: dayOffset(-12) },
    { id: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000005', org_id: ORG.sportizo, client_id: null, venue_id: V.badminton, sport_id: S.badminton, rating: 4, title: 'Enjoyable sessions', body: 'Friendly staff and clean changing rooms.', author_name: 'Sneha Rao', status: 'published', review_date: dayOffset(-4) },
    { id: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000006', org_id: ORG.sportizo, client_id: null, venue_id: V.pool, sport_id: S.swimming, rating: 2, title: 'Too crowded', body: 'Pool is overcrowded during peak evening hours.', author_name: 'Deepak Verma', status: 'published', review_date: dayOffset(-2) },
    // Calirox
    { id: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000007', org_id: ORG.calirox, client_id: '88888888-8888-4888-8888-000000000007', venue_id: V.sector56, sport_id: S.caliroxBadminton, rating: 5, title: 'Best badminton in the area', body: 'Excellent courts and coaching. Highly recommend.', author_name: 'Meera Iyer', status: 'published', review_date: dayOffset(-5) },
    { id: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000008', org_id: ORG.calirox, client_id: '88888888-8888-4888-8888-000000000008', venue_id: V.sector56, sport_id: S.caliroxBadminton, rating: 4, title: 'Solid experience', body: 'Good value memberships.', author_name: 'Sameer Khan', status: 'hidden', review_date: dayOffset(-8) },
    // Demo
    { id: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000009', org_id: ORG.demo, client_id: '88888888-8888-4888-8888-000000000009', venue_id: V.demoAcademy, sport_id: S.demoBadminton, rating: 5, title: 'Nice academy', body: 'Clean, well-run, and friendly.', author_name: 'Demo Client', status: 'published', review_date: dayOffset(-1) },
  ],

  tickets: [
    // Sportizo — spread across kanban columns and priorities.
    { id: 'bbbbbbbb-bbbb-4bbb-8bbb-000000000001', org_id: ORG.sportizo, client_id: null, title: 'Leaking roof over Court 3', description: 'Water dripping onto the clay court after rain — needs sealing.', category: 'Maintenance', priority: 'high', status: 'open', assignee: 'Ravi', due_date: dayOffset(2) },
    { id: 'bbbbbbbb-bbbb-4bbb-8bbb-000000000002', org_id: ORG.sportizo, client_id: '88888888-8888-4888-8888-000000000001', title: 'Membership renewal query', description: 'Rahul asked about upgrading to an annual plan.', category: 'Billing', priority: 'medium', status: 'open', assignee: 'Front Desk', due_date: dayOffset(4) },
    { id: 'bbbbbbbb-bbbb-4bbb-8bbb-000000000003', org_id: ORG.sportizo, client_id: null, title: 'Broken net on Cricket Net 1', description: 'Netting torn on the left side.', category: 'Maintenance', priority: 'high', status: 'in_progress', assignee: 'Ravi', due_date: dayOffset(1) },
    { id: 'bbbbbbbb-bbbb-4bbb-8bbb-000000000004', org_id: ORG.sportizo, client_id: '88888888-8888-4888-8888-000000000002', title: 'Refund request', description: 'Priya requested a refund for a cancelled slot.', category: 'Billing', priority: 'medium', status: 'in_progress', assignee: 'Accounts', due_date: dayOffset(3) },
    { id: 'bbbbbbbb-bbbb-4bbb-8bbb-000000000005', org_id: ORG.sportizo, client_id: null, title: 'AC not cooling — Indoor Badminton', description: 'Reported by evening players.', category: 'Facilities', priority: 'medium', status: 'resolved', assignee: 'Ravi', due_date: dayOffset(-1) },
    { id: 'bbbbbbbb-bbbb-4bbb-8bbb-000000000006', org_id: ORG.sportizo, client_id: null, title: 'Website booking glitch', description: 'Double-booking edge case on the public site.', category: 'General', priority: 'low', status: 'closed', assignee: 'Tech', due_date: dayOffset(-5) },
    // Calirox
    { id: 'bbbbbbbb-bbbb-4bbb-8bbb-000000000007', org_id: ORG.calirox, client_id: null, title: 'Coach schedule conflict', description: 'Two coaches booked for the same slot.', category: 'General', priority: 'medium', status: 'open', assignee: 'Admin', due_date: dayOffset(2) },
    { id: 'bbbbbbbb-bbbb-4bbb-8bbb-000000000008', org_id: ORG.calirox, client_id: null, title: 'Locker room deep clean', description: 'Monthly deep clean scheduled.', category: 'Maintenance', priority: 'low', status: 'resolved', assignee: 'Housekeeping', due_date: dayOffset(-2) },
    // Demo
    { id: 'bbbbbbbb-bbbb-4bbb-8bbb-000000000009', org_id: ORG.demo, client_id: null, title: 'Sample support ticket', description: 'Demo ticket for the board.', category: 'General', priority: 'low', status: 'open', assignee: 'Demo', due_date: dayOffset(6) },
  ],

  // ---- RBAC (built above) ----
  staff: STAFF,
  org_members: ORG_MEMBERS,
  actions: ACTIONS,
  roles: ROLES,
  role_permissions: ROLE_PERMISSIONS,
};
