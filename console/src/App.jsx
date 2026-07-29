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
import Bookings from './pages/Bookings';
import Financials from './pages/Financials';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Contracts from './pages/Contracts';
import Reviews from './pages/Reviews';
import Tickets from './pages/Tickets';
import Analytics from './pages/Analytics';
import Users from './pages/Users';
import Roles from './pages/Roles';
import Actions from './pages/Actions';
import Placeholder from './pages/Placeholder';
import { NoStaffRecord } from './pages/Login';

// Where an unauthenticated visitor is sent. The console lives under /app on the
// marketing origin, so the football sign-in page is a same-origin sibling.
// Overridable for standalone console dev on a different origin.
const SIGNIN_URL = import.meta.env.VITE_SIGNIN_URL || '/signin.html';

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

// Decides between the console, the "no staff row" helper, and bouncing an
// unauthenticated visitor back to the marketing sign-in page. The console no
// longer has its own login form — sign-in happens once on /signin and the
// session is shared because both live on the same origin.
function Gate({ children }) {
  const { status } = useAuth();
  if (status === 'signed-out') {
    window.location.assign(SIGNIN_URL);
    return <div className="login__splash">Redirecting to sign in…</div>;
  }
  if (status === 'loading') return <div className="login__splash">Loading console…</div>;
  if (status === 'no-staff-record') return <NoStaffRecord />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter basename="/app">
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
                <Route path="/" element={<Dashboard />} />
                <Route path="/bookings" element={<Bookings />} />
                <Route path="/financials" element={<Financials />} />

                <Route path="/organisation" element={<Organisations />} />
                <Route path="/timeslot" element={<TimeSlots />} />
                <Route path="/facility-management" element={<Facility />} />

                <Route path="/users/roles" element={<Roles />} />
                <Route path="/users" element={<Users />} />
                <Route path="/actions" element={<Actions />} />

                <Route path="/contracts" element={<Contracts />} />
                <Route path="/clients" element={<Clients />} />

                <Route path="/analytics" element={<Analytics />} />
                <Route path="/reviews" element={<Reviews />} />
                <Route path="/tickets" element={<Tickets />} />

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
