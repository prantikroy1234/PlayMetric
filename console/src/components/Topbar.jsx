import { useEffect, useRef, useState } from 'react';
import { IconSearch, IconSettings, IconBell, IconChevronDown } from './Icons';
import { Avatar } from './ui';
import { useAuth } from '../lib/auth';

export default function Topbar() {
  const { staff, signOut, authEnabled } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const name = staff?.full_name || 'Signed in';
  const role = staff?.is_platform_admin ? 'Owner' : 'Staff';

  return (
    <header className="topbar">
      <div className="search">
        <span className="search__icon">
          <IconSearch width={16} height={16} />
        </span>
        <input type="search" placeholder="Search..." aria-label="Search" />
        <span className="search__kbd">⌘K</span>
      </div>

      <span className="topbar__spacer" />

      <button className="iconbtn" aria-label="Settings">
        <IconSettings />
      </button>
      <button className="iconbtn" aria-label="Notifications">
        <IconBell />
      </button>

      <div ref={wrapRef} style={{ position: 'relative' }}>
        <button
          className="userchip"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <Avatar name={name} accent="violet" size="sm" />
          <span className="userchip__meta">
            <span className="userchip__name">{name}</span>
            <br />
            <span className="userchip__role">{role}</span>
          </span>
          <IconChevronDown width={15} height={15} />
        </button>

        {open && (
          <div className="usermenu" role="menu">
            <div className="usermenu__head">
              <div className="usermenu__name">{name}</div>
              <div className="usermenu__email">{staff?.email}</div>
            </div>
            {authEnabled ? (
              <button className="usermenu__item" onClick={signOut} role="menuitem">
                Sign out
              </button>
            ) : (
              <div className="usermenu__note">Local demo mode — no sign-in required.</div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
