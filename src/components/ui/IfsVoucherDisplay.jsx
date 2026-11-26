import React, { useState } from 'react';

const IFS_EXPLORER_URL = 'https://ifsprod.apmterminals.com/client/runtime/Ifs.Fnd.Explorer.application';

function shortDate(dt) {
  if (!dt) return '';
  try {
    return new Date(dt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

/**
 * Displays active IFS voucher number (clickable ERP link) along with any cancelled
 * IFS voucher numbers (rendered in readable gray with a thin strikethrough line).
 * Supports optional inline edit (when canEdit=true) and cancel/replace action (when onCancelClick provided).
 */
export default function IfsVoucherDisplay({
  activeVoucher,
  cancelledVouchers = [],
  canEdit = false,
  canCancel = false,
  onSaveEdit,
  onCancelClick,
  compact = false,
  accent = 'blue',
  onDarkBg = false
}) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState('');
  const [saving, setSaving] = useState(false);

  const cancelledList = Array.isArray(cancelledVouchers) ? cancelledVouchers : [];
  const hasActive = Boolean(activeVoucher && String(activeVoucher).trim());

  if (!hasActive && cancelledList.length === 0) {
    return <span className="text-slate-300 text-xs">-</span>;
  }

  async function handleSave() {
    if (!editVal.trim() || !onSaveEdit) return;
    setSaving(true);
    try {
      await onSaveEdit(editVal.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  const saveBtnClass = accent === 'teal'
    ? 'px-2 py-1 rounded bg-teal-600 text-white text-xs font-medium hover:bg-teal-700 disabled:opacity-50'
    : 'px-2 py-1 rounded bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50';

  const cancelledTextClass = onDarkBg
    ? 'text-slate-300 decoration-slate-300/90'
    : 'text-slate-500 decoration-slate-500/80';

  return (
    <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
      {hasActive && (
        editing ? (
          <div className="flex items-center gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
            <input
              value={editVal}
              onChange={e => setEditVal(e.target.value)}
              className="px-2 py-1 rounded border border-blue-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 w-40 font-mono"
              autoFocus
            />
            <button type="button" onClick={handleSave} disabled={saving || !editVal.trim()} className={saveBtnClass}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button type="button" onClick={() => setEditing(false)} disabled={saving} className="px-2 py-1 rounded bg-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-300">
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 flex-wrap">
            <a
              href={IFS_EXPLORER_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className={`text-blue-600 hover:underline inline-flex items-center gap-1 font-semibold font-mono ${compact ? 'text-xs' : 'text-sm'}`}
              title="Open in IFS Explorer"
            >
              {activeVoucher}
              <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>

            {canEdit && onSaveEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditVal(activeVoucher);
                  setEditing(true);
                }}
                className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition"
                title="Edit IFS Voucher Number"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}

            {canCancel && onCancelClick && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCancelClick();
                }}
                className="px-2 py-0.5 rounded bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 text-[11px] font-semibold transition"
                title="Cancel this IFS Voucher Number and replace it with a new one"
              >
                Cancel
              </button>
            )}
          </div>
        )
      )}

      {cancelledList.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          {cancelledList.map((c, idx) => {
            const vNum = typeof c === 'string' ? c : c.voucher_number;
            if (!vNum) return null;
            const datePart = c?.cancelled_at ? ` on ${shortDate(c.cancelled_at)}` : '';
            const reasonPart = c?.reason ? ` | Reason: ${c.reason}` : '';
            const replacedPart = c?.replaced_by ? ` -> Replaced by ${c.replaced_by}` : '';
            const tooltip = `Cancelled IFS Voucher${datePart}${replacedPart}${reasonPart}`;
            return (
              <span
                key={`${vNum}-${idx}`}
                title={tooltip}
                className={`font-mono ${compact ? 'text-[11px]' : 'text-xs'} line-through decoration-1 ${cancelledTextClass} select-text`}
              >
                {vNum}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
