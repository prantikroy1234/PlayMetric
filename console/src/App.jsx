import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import { ToastProvider } from './lib/toast';
import { AuthProvider, useAuth } from './lib/auth';
import { dataMode } from './lib/data';
import { IconDatabase } from './components/Icons';

import Organisations from './pages/Organisations';
import Facility from './pages/Facility';
import TimeSlots from './pages/TimeSlots';
import Placeholder from './pages/Placeholder';
import Login, { NoStaffRecord } from './pages/Login';

function DataModeBanner() {
  if (dataMode === 'supabase') return null;
  return (
    <div className="banner banner--info">
      <IconDatabase width={16} height={16} />
      <span>
        Running on <strong>local demo data</strong> (saved in your browser). Set{' '}
        <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in{' '}
        <code>console/.env.local</code> to switch to Supabase.
      </span>
    </div>
  );
}

const stub = (title, subtitle) => <Placeholder title={title} subtitle={subtitle} />;

// Decides between the login screen, the "no staff row" helper, and the console.
function Gate({ children }) {
  const { status } = useAuth();
  if (status === 'loading') return <div className="login__splash">Loading console…</div>;
  if (status === 'signed-out') return <Login />;
  if (status === 'no-staff-record') return <NoStaffRecord />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
      <ToastProvider>
        <Gate>
        <div className="app">
          <Sidebar />
          <div className="main">
            <Topbar />
            <main className="content">
              <DataModeBanner />
              <Routes>
                <Route
                  path="/"
                  element={stub('Overview', "Welcome back, here's what's happening at your academy.")}
                />
                <Route
                  path="/bookings"
                  element={stub('Booking Management', 'Manage and schedule venue courts')}
                />
                <Route
                  path="/financials"
                  element={stub('Financial Management', 'Aggregated at Business Level')}
                />

                <Route path="/organisation" element={<Organisations />} />
                <Route path="/timeslot" element={<TimeSlots />} />
                <Route path="/facility-management" element={<Facility />} />

                <Route
                  path="/users/roles"
                  element={stub('Roles & Permissions', 'Configure fine-grained module access for team roles.')}
                />
                <Route
                  path="/users"
                  element={stub('Users & Staff', 'Manage roles, permissions, and internal team access')}
                />
                <Route
                  path="/actions"
                  element={stub('Actions & Hierarchy', 'Configure system subsystems, modules, submodules, and permission mappings')}
                />

                <Route
                  path="/contracts"
                  element={stub('Contracts & Agreements', 'Manage all legal documents, leases, and service agreements')}
                />
                <Route
                  path="/clients"
                  element={stub('Client Directory', 'Manage individual players, teams, and corporate accounts')}
                />

                <Route
                  path="/analytics"
                  element={stub('Business Analytics', 'Data-driven insights for venue performance')}
                />
                <Route
                  path="/reviews"
                  element={stub('Consolidated Reviews', 'Monitor client feedback and venue ratings')}
                />
                <Route
                  path="/tickets"
                  element={stub('Support Tickets', 'Client inquiries, issue tracking, and maintenance requests')}
                />

                <Route path="*" element={stub('Not found', 'That page does not exist in the console.')} />
              </Routes>
            </main>
          </div>
        </div>
        </Gate>
      </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
