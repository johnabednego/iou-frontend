import React, { useState, useEffect } from 'react';

export default function CancelIfsVoucherModal({
  isOpen,
  currentVoucher,
  requestNumber,
  onClose,
  onConfirm,
  loading = false
}) {
  const [newVoucher, setNewVoucher] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setNewVoucher('');
      setReason('');
      setError('');
    }
  }, [isOpen, currentVoucher]);

  if (!isOpen) return null;

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = newVoucher.trim();
    if (!trimmed) {
      setError('A new IFS Voucher Number is required.');
      return;
    }
    if (currentVoucher && trimmed.toLowerCase() === String(currentVoucher).trim().toLowerCase()) {
      setError('The new IFS Voucher Number must be different from the one being cancelled.');
      return;
    }
    setError('');
    onConfirm({ new_ifs_voucher_number: trimmed, reason: reason.trim() });
  }

  return (
    <div
      className="fixed inset-0 bg-black/45 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={() => !loading && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Cancel & Replace IFS Voucher</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Cancelling IFS Voucher <span className="font-mono font-semibold text-slate-700">{currentVoucher}</span>
              {requestNumber ? ` on ${requestNumber}` : ''}. The cancelled number will remain linked to this request for tracking and search.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              New IFS Voucher Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newVoucher}
              onChange={e => { setNewVoucher(e.target.value); setError(''); }}
              placeholder="Enter replacement IFS Voucher #..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm font-mono"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Cancellation Reason (optional)
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
              placeholder="Explain why the previous IFS Voucher is being cancelled..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm resize-none"
            />
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
              {error}
            </div>
          )}

          <div className="flex gap-3 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={loading || !newVoucher.trim()}
              className="px-5 py-2 rounded-lg text-white font-semibold text-sm shadow-md bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Processing...' : 'Cancel Old & Save New'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
