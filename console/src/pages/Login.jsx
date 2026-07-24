import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { Field } from '../components/ui';

// Deep-navy backdrop with a few softly floating dimpled spheres. Pure CSS —
// no sourced imagery. Shared by the sign-in and "no staff record" screens.
function Backdrop() {
  return (
    <div className="authbg" aria-hidden="true">
      <span className="authbg__sphere authbg__sphere--1" />
      <span className="authbg__sphere authbg__sphere--2" />
      <span className="authbg__sphere authbg__sphere--3" />
    </div>
  );
}

function Brand() {
  return (
    <div className="login__brand">
      <img src="/playmetric-logo.png" alt="" className="login__logo" />
      <span className="login__word">PLAYMETRIC</span>
    </div>
  );
}

function AvatarBadge() {
  return (
    <div className="login__avatar" aria-hidden="true">
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8.5" r="3.6" fill="currentColor" />
        <path
          d="M4.5 20c0-3.8 3.2-6.4 7.5-6.4s7.5 2.6 7.5 6.4"
          fill="currentColor"
        />
      </svg>
      <span className="login__avatar-dot" />
    </div>
  );
}

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      // On success the auth listener swaps this screen out for the console.
    } catch (err) {
      setError(err.message || 'Could not sign in. Check your details and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <Backdrop />
      <div className="login__card">
        <Brand />
        <AvatarBadge />

        <h1 className="login__title">Welcome back</h1>
        <p className="login__subtitle">Sign in with your staff account to continue.</p>

        <form onSubmit={submit} className="login__form" noValidate>
          <Field label="Email">
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@playmetric.in"
            />
          </Field>

          <Field label="Password">
            <span className="login__pw">
              <input
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button
                type="button"
                className="login__pw-toggle"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? 'Hide password' : 'Show password'}
              >
                {show ? 'Hide' : 'Show'}
              </button>
            </span>
          </Field>

          {error && <p className="login__error">{error}</p>}

          <button type="submit" className="login__submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* Shown when auth succeeded but no matching staff row exists — the exact
   situation where RLS correctly returns nothing and the console looks broken. */
export function NoStaffRecord() {
  const { session, signOut } = useAuth();
  const email = session?.user?.email ?? 'your account';

  return (
    <div className="login">
      <Backdrop />
      <div className="login__card login__card--wide">
        <Brand />

        <h1 className="login__title">Almost there</h1>
        <p className="login__subtitle">
          You’re signed in as <strong>{email}</strong>, but there’s no staff record linked to it
          yet — so the database is correctly showing you nothing.
        </p>

        <p className="login__hint">Run this once in the Supabase SQL editor:</p>
        <pre className="login__code">
{`insert into public.staff (id, full_name, email, employee_code, is_platform_admin)
select id, 'Your Name', email, 'PM-001', true
from auth.users where email = '${email}'
on conflict (id) do update set is_platform_admin = true;`}
        </pre>

        <div className="login__actions">
          <button className="login__submit" onClick={() => window.location.reload()}>
            I’ve run it — reload
          </button>
          <button className="btn btn--ghost" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
