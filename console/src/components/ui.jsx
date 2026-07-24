import { useEffect, useRef } from 'react';
import { IconClose, IconSearch } from './Icons';

/* ------------------------------- Avatar ------------------------------- */
const ACCENTS = ['cyan', 'violet', 'blue', 'green', 'amber'];

export function Avatar({ name = '?', accent, size }) {
  // Stable colour when none is stored, so a row keeps its tint across reloads.
  const tint =
    accent ||
    ACCENTS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % ACCENTS.length];
  return (
    <span className={`avatar avatar--${tint}${size === 'sm' ? ' avatar--sm' : ''}`}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/* -------------------------------- Chip -------------------------------- */
export function Chip({ children, variant, mono }) {
  const cls = ['chip', variant && `chip--${variant}`, mono && 'chip--mono']
    .filter(Boolean)
    .join(' ');
  return <span className={cls}>{children}</span>;
}

/* ----------------------------- Page header ---------------------------- */
export function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="pagehead">
      <div>
        <h1 className="pagehead__title">{title}</h1>
        {subtitle && <p className="pagehead__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="pagehead__actions">{actions}</div>}
    </header>
  );
}

/* ------------------------------- Field -------------------------------- */
export function Field({ label, required, error, hint, children }) {
  return (
    <label className="field">
      <span className="field__label">
        {label} {required && <span>*</span>}
      </span>
      {children}
      {error ? (
        <span className="field__error">{error}</span>
      ) : (
        hint && <span className="field__hint">{hint}</span>
      )}
    </label>
  );
}

/* ------------------------------- Modal -------------------------------- */
export function Modal({ title, subtitle, onClose, children, footer }) {
  const panelRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // Focus the first control so keyboard users land inside the dialog.
    panelRef.current?.querySelector('input, select, textarea, button')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="modal-scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" ref={panelRef} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal__head">
          <div>
            <h2 className="modal__title">{title}</h2>
            {subtitle && <p className="modal__subtitle">{subtitle}</p>}
          </div>
          <button className="iconbtn" onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------------------------- Confirm modal --------------------------- */
export function ConfirmModal({ title, message, confirmLabel = 'Delete', onConfirm, onClose, busy }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn--danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ color: 'var(--ink-muted)', lineHeight: 1.6 }}>{message}</p>
    </Modal>
  );
}

/* ------------------------------- Empty -------------------------------- */
export function EmptyState({ icon, title, text, action }) {
  return (
    <div className="empty">
      {icon && <div className="empty__icon">{icon}</div>}
      <p className="empty__title">{title}</p>
      {text && <p className="empty__text">{text}</p>}
      {action && <div style={{ marginTop: '1.25rem' }}>{action}</div>}
    </div>
  );
}

/* ------------------------------ Skeleton ------------------------------ */
export function TableSkeleton({ cols = 4, rows = 4 }) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((__, c) => (
            <td key={c}>
              <div className="skeleton-row" style={{ width: c === 0 ? '60%' : '40%' }} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

/* ---------------------------- Search input ---------------------------- */
export function SearchInline({ value, onChange, placeholder }) {
  return (
    <div className="search-inline">
      <IconSearch width={15} height={15} />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/* ----------------------------- Pagination ----------------------------- */
export function Pagination({ page, perPage, total, onPage, onPerPage }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  return (
    <div className="pagination">
      <span>Rows per page:</span>
      <select value={perPage} onChange={(e) => onPerPage(Number(e.target.value))}>
        {[10, 25, 50].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <span>
        Showing {from} to {to} of {total}
      </span>
      <span className="pagination__spacer" />
      <button onClick={() => onPage(page - 1)} disabled={page <= 1}>
        Prev
      </button>
      <button onClick={() => onPage(page + 1)} disabled={page >= pages}>
        Next
      </button>
    </div>
  );
}

/* ------------------------------- Toasts ------------------------------- */
export function Toasts({ items }) {
  if (!items.length) return null;
  return (
    <div className="toasts">
      {items.map((t) => (
        <div key={t.id} className={`toast toast--${t.kind}`} role="status">
          {t.message}
        </div>
      ))}
    </div>
  );
}
