import {
  weekDays, monthMatrix, isSameMonth, todayISO,
  formatTime12, minutesOf, dayNumber, dowShort,
} from './dates';

// Resource-timeline day view runs 6 AM → 10 PM.
const DAY_START = 6;
const DAY_END = 22;
const SPAN = (DAY_END - DAY_START) * 60;
const HOURS = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);

export const STATUS_META = {
  confirmed: { label: 'Confirmed', cls: 'is-confirmed' },
  pending: { label: 'Pending', cls: 'is-pending' },
  completed: { label: 'Completed', cls: 'is-completed' },
  cancelled: { label: 'Cancelled', cls: 'is-cancelled' },
};

function hourLabel(h) {
  if (h === 12) return '12p';
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

/* --------------------------------- Pill -------------------------------- */
// Compact booking chip used by the week and month views.
function Pill({ booking, onClick, showCourt, courtName }) {
  const meta = STATUS_META[booking.status] || STATUS_META.confirmed;
  return (
    <button className={`bk-pill ${meta.cls}`} onClick={() => onClick(booking)} title={`${booking.client_name} · ${meta.label}`}>
      <span className="bk-pill__time">{formatTime12(booking.start_time)}</span>
      <span className="bk-pill__name">{booking.client_name}</span>
      {showCourt && courtName && <span className="bk-pill__court">{courtName}</span>}
    </button>
  );
}

/* ------------------------------ Day view ------------------------------- */
// Rows = courts (a court can't be double-booked, so blocks never overlap
// within a row). Court-less bookings collect in an "Unassigned" row.
export function DayView({ dateISO, bookings, courts, byId, onEdit, onCreateAt }) {
  const dayBookings = bookings.filter((b) => b.booking_date === dateISO);

  const rows = courts.map((c) => ({
    key: c.id,
    court: c,
    bookings: dayBookings.filter((b) => b.court_id === c.id),
  }));
  const unassigned = dayBookings.filter((b) => !b.court_id || !byId.court[b.court_id]);
  if (unassigned.length) {
    rows.push({ key: 'unassigned', court: null, bookings: unassigned });
  }

  return (
    <div className="daycal">
      <div className="daycal__head">
        <div className="daycal__corner">Court</div>
        <div className="daycal__hours">
          {HOURS.map((h) => (
            <span key={h} className="daycal__hour">{hourLabel(h)}</span>
          ))}
        </div>
      </div>

      <div className="daycal__body">
        {rows.length === 0 && (
          <div className="daycal__empty">No courts configured for this selection.</div>
        )}
        {rows.map((row) => (
          <div className="daycal__row" key={row.key}>
            <div className="daycal__rowlabel">
              <span className="daycal__court">{row.court ? row.court.name : 'Unassigned'}</span>
              {row.court && (
                <small>{byId.venue[row.court.venue_id]?.name || '—'}</small>
              )}
            </div>
            <div
              className="daycal__track"
              onClick={(e) => {
                // Click empty track → prefill a new booking at that court.
                if (e.target !== e.currentTarget) return;
                onCreateAt({ court: row.court, dateISO });
              }}
            >
              {row.bookings.map((b) => {
                const start = Math.max(minutesOf(b.start_time), DAY_START * 60);
                const end = Math.min(minutesOf(b.end_time), DAY_END * 60);
                const left = ((start - DAY_START * 60) / SPAN) * 100;
                const width = Math.max(((end - start) / SPAN) * 100, 4);
                const meta = STATUS_META[b.status] || STATUS_META.confirmed;
                return (
                  <button
                    key={b.id}
                    className={`daycal__block ${meta.cls}`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    onClick={() => onEdit(b)}
                  >
                    <span className="daycal__block-name">{b.client_name}</span>
                    <span className="daycal__block-time">
                      {formatTime12(b.start_time)}–{formatTime12(b.end_time)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ Week view ------------------------------ */
export function WeekView({ dateISO, bookings, byId, onEdit, onCreateAt }) {
  const days = weekDays(dateISO);
  const today = todayISO();

  return (
    <div className="weekcal">
      {days.map((d) => {
        const items = bookings
          .filter((b) => b.booking_date === d)
          .sort((a, b) => a.start_time.localeCompare(b.start_time));
        return (
          <div className={`weekcal__col${d === today ? ' is-today' : ''}`} key={d}>
            <div className="weekcal__head">
              <span className="weekcal__dow">{dowShort(d)}</span>
              <span className="weekcal__num">{dayNumber(d)}</span>
            </div>
            <div className="weekcal__body">
              {items.length === 0 ? (
                <button className="weekcal__add" onClick={() => onCreateAt({ dateISO: d })}>
                  +
                </button>
              ) : (
                items.map((b) => (
                  <Pill
                    key={b.id}
                    booking={b}
                    onClick={onEdit}
                    showCourt
                    courtName={byId.court[b.court_id]?.name}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------ Month view ----------------------------- */
export function MonthView({ dateISO, bookings, byId, onEdit, onCreateAt, onOpenDay }) {
  const weeks = monthMatrix(dateISO);
  const today = todayISO();
  const MAX = 3;

  return (
    <div className="monthcal">
      <div className="monthcal__dows">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="monthcal__grid">
        {weeks.flat().map((d) => {
          const items = bookings
            .filter((b) => b.booking_date === d)
            .sort((a, b) => a.start_time.localeCompare(b.start_time));
          const muted = !isSameMonth(d, dateISO);
          return (
            <div
              className={`monthcal__cell${muted ? ' is-muted' : ''}${d === today ? ' is-today' : ''}`}
              key={d}
            >
              <div className="monthcal__cellhead">
                <button className="monthcal__daynum" onClick={() => onOpenDay(d)}>
                  {dayNumber(d)}
                </button>
                <button
                  className="monthcal__celladd"
                  onClick={() => onCreateAt({ dateISO: d })}
                  aria-label="Add booking"
                >
                  +
                </button>
              </div>
              <div className="monthcal__items">
                {items.slice(0, MAX).map((b) => (
                  <Pill
                    key={b.id}
                    booking={b}
                    onClick={onEdit}
                    showCourt
                    courtName={byId.court[b.court_id]?.name}
                  />
                ))}
                {items.length > MAX && (
                  <button className="monthcal__more" onClick={() => onOpenDay(d)}>
                    +{items.length - MAX} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------- Transactions tab -------------------------- */
export function TransactionsView({ bookings, byId }) {
  const rows = [...bookings].sort(
    (a, b) =>
      b.booking_date.localeCompare(a.booking_date) ||
      b.start_time.localeCompare(a.start_time)
  );
  const total = rows
    .filter((b) => b.status !== 'cancelled')
    .reduce((sum, b) => sum + Number(b.amount || 0), 0);

  return (
    <div className="card">
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Client</th>
              <th>Court</th>
              <th>Time</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => {
              const meta = STATUS_META[b.status] || STATUS_META.confirmed;
              return (
                <tr key={b.id}>
                  <td>{b.booking_date}</td>
                  <td className="cell-title">{b.client_name}</td>
                  <td>{byId.court[b.court_id]?.name || '—'}</td>
                  <td>{formatTime12(b.start_time)}–{formatTime12(b.end_time)}</td>
                  <td><span className={`bk-badge ${meta.cls}`}>{meta.label}</span></td>
                  <td style={{ textAlign: 'right' }}>{money(b.amount)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={6} style={{ color: 'var(--ink-faint)' }}>No bookings yet.</td></tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={5} style={{ textAlign: 'right', fontWeight: 600 }}>
                  Collected (excl. cancelled)
                </td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
