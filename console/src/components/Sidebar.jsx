import { NavLink } from 'react-router-dom';
import {
  IconDashboard, IconCalendar, IconWallet, IconSitemap, IconClock, IconBall,
  IconUserCog, IconUser, IconKey, IconContract, IconUsers, IconChart,
  IconStar, IconTicket,
} from './Icons';

// Mirrors the live console's grouping exactly.
export const NAV_GROUPS = [
  {
    label: 'MAIN',
    items: [
      { to: '/', label: 'Dashboard', icon: IconDashboard, end: true },
      { to: '/bookings', label: 'Booking Management', icon: IconCalendar },
      { to: '/financials', label: 'Financial Management', icon: IconWallet },
    ],
  },
  {
    label: 'CONFIGURATION',
    items: [
      { to: '/organisation', label: 'Academy', icon: IconSitemap },
      { to: '/timeslot', label: 'Time Slots', icon: IconClock },
      { to: '/facility-management', label: 'Sports Management', icon: IconBall },
    ],
  },
  {
    label: 'PERMISSIONS',
    items: [
      { to: '/users/roles', label: 'User Role', icon: IconUserCog },
      { to: '/users', label: 'Users', icon: IconUser, end: true },
      { to: '/actions', label: 'Actions', icon: IconKey },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { to: '/contracts', label: 'Contracts', icon: IconContract },
      { to: '/clients', label: 'Clients', icon: IconUsers },
    ],
  },
  {
    label: 'INSIGHTS & SUPPORT',
    items: [
      { to: '/analytics', label: 'Analytics', icon: IconChart },
      { to: '/reviews', label: 'Reviews', icon: IconStar },
      { to: '/tickets', label: 'Tickets', icon: IconTicket },
    ],
  },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <img src="/playmetric-logo.png" alt="" className="sidebar__logo" />
        <span className="sidebar__word">PLAYMETRIC</span>
      </div>

      <nav className="sidebar__nav">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="navgroup__label">{group.label}</p>
            {group.items.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => `navitem${isActive ? ' is-active' : ''}`}
              >
                <Icon />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
