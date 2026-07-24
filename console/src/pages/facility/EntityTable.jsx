import { useState } from 'react';
import {
  Chip, EmptyState, TableSkeleton, Pagination, ConfirmModal,
} from '../../components/ui';
import { IconEdit, IconTrash, IconPlus, IconLayers } from '../../components/Icons';

// Shared table shell for all four facility entities: search filtering,
// pagination, empty states, and edit/delete actions. Each entity supplies its
// own columns and form; everything else is identical, so it lives here once.
export default function EntityTable({
  columns,
  rows,
  loading,
  query,
  searchKeys,
  emptyTitle,
  emptyText,
  addLabel,
  onAdd,
  onEdit,
  onDelete,
  deleteMessage,
}) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? rows.filter((r) =>
        searchKeys.some((k) => String(r[k] ?? '').toLowerCase().includes(q))
      )
    : rows;

  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, pages);
  const pageRows = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  async function confirmDelete() {
    setBusy(true);
    try {
      await onDelete(deleting);
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key}>{c.header}</th>
              ))}
              <th className="cell-actions">Actions</th>
            </tr>
          </thead>

          {loading ? (
            <TableSkeleton cols={columns.length + 1} rows={4} />
          ) : (
            <tbody>
              {pageRows.map((row) => (
                <tr key={row.id}>
                  {columns.map((c) => (
                    <td key={c.key}>{c.render ? c.render(row) : row[c.key] || '—'}</td>
                  ))}
                  <td className="cell-actions">
                    <button className="linkbtn" onClick={() => onEdit(row)}>
                      <IconEdit width={14} height={14} /> Edit
                    </button>
                    <button className="linkbtn linkbtn--danger" onClick={() => setDeleting(row)}>
                      <IconTrash width={14} height={14} /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>

      {!loading && filtered.length === 0 && (
        <EmptyState
          icon={<IconLayers width={24} height={24} />}
          title={q ? 'No matches' : emptyTitle}
          text={q ? 'Try a different search term.' : emptyText}
          action={
            !q && (
              <button className="btn btn--primary" onClick={onAdd}>
                <IconPlus width={16} height={16} /> {addLabel}
              </button>
            )
          }
        />
      )}

      {!loading && filtered.length > 0 && (
        <Pagination
          page={safePage}
          perPage={perPage}
          total={filtered.length}
          onPage={setPage}
          onPerPage={(n) => {
            setPerPage(n);
            setPage(1);
          }}
        />
      )}

      {deleting && (
        <ConfirmModal
          title={`Delete ${deleting.name || deleting.label}?`}
          message={deleteMessage}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
          busy={busy}
        />
      )}
    </div>
  );
}

// Small helper reused by several columns.
export function OrgChip({ org }) {
  if (!org) return <Chip>—</Chip>;
  return <Chip>{org.name}</Chip>;
}
