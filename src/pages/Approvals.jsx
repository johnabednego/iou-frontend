import React, { useEffect, useState } from 'react';
import { getMyApprovals, decideApproval } from '../services/iouService';
import Card from '../components/ui/Card';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';

function fmt(n, currency = 'GHS') {
  if (n == null) return `${currency} 0.00`;
  const localeMap = { GHS: 'en-GH', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB' };
  try {
    return new Intl.NumberFormat(localeMap[currency] || 'en-US', { style: 'currency', currency }).format(n);
  } catch {
    return `${currency} ${Number(n).toFixed(2)}`;
  }
}

export default function Approvals() {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [comments, setComments] = useState('');
  const [deciding, setDeciding] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await getMyApprovals();
      const list = r.data.data || [];
      setApprovals(list);
      window.dispatchEvent(new CustomEvent('approvals-count-sync', { detail: { count: list.length } }));
    } catch {
      setApprovals([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  function openModal(a, decision) {
    const isDE = a.approval_type === 'direct_expense';
    setModal({
      id: a.id,
      decision,
      iou: a.iou,
      directExpense: a.directExpense,
      approval_type: a.approval_type || 'iou',
      // For display in modal
      requestNumber: isDE ? a.directExpense?.request_number : a.iou?.request_number,
      amount: isDE ? a.directExpense?.amount : a.iou?.estimated_amount,
      currency: isDE ? a.directExpense?.currency : a.iou?.currency
    });
    setComments('');
  }

  async function confirm() {
    if (!modal) return;
    setDeciding(true);
    try {
      await decideApproval(modal.id, { decision: modal.decision, comments });
      setApprovals(a => {
        const next = a.filter(x => x.id !== modal.id);
        window.dispatchEvent(new CustomEvent('approvals-count-sync', { detail: { count: next.length } }));
        return next;
      });
      setModal(null);
      toast.success(`Decision recorded: ${modal.decision}`);
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed'); }
    finally { setDeciding(false); }
  }

  const colors = { APPROVED: 'from-emerald-500 to-emerald-700', RETURNED: 'from-yellow-400 to-yellow-600', REJECTED: 'from-red-500 to-red-700' };

  // Separate IOU, expense, and direct expense approvals
  const iouApprovals = approvals.filter(a => !a.approval_type || a.approval_type === 'iou');
  const expenseApprovals = approvals.filter(a => a.approval_type === 'expense');
  const directExpenseApprovals = approvals.filter(a => a.approval_type === 'direct_expense');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pending Approvals</h1>
          <p className="text-sm text-slate-500 mt-1">
            Review and make decisions on IOU requests, expense reconciliations, and direct expenses awaiting your sign-off.
          </p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-5 shadow-lg text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-amber-100 uppercase tracking-wider">Awaiting Decision</span>
            <div className="p-1.5 rounded-lg bg-white/15">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            </div>
          </div>
          <div className="text-3xl font-extrabold">{approvals.length}</div>
          <div className="text-xs text-amber-100 mt-1">Total pending in your queue</div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-700 p-5 shadow-lg text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-indigo-100 uppercase tracking-wider">IOU Requests</span>
            <div className="p-1.5 rounded-lg bg-white/15">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
            </div>
          </div>
          <div className="text-3xl font-extrabold">{iouApprovals.length}</div>
          <div className="text-xs text-indigo-100 mt-1">New advance requests</div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-800 p-5 shadow-lg text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-purple-100 uppercase tracking-wider">Expense Approvals</span>
            <div className="p-1.5 rounded-lg bg-white/15">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="2" /></svg>
            </div>
          </div>
          <div className="text-3xl font-extrabold">{expenseApprovals.length}</div>
          <div className="text-xs text-purple-100 mt-1">Reconciliations to verify</div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-700 p-5 shadow-lg text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-teal-100 uppercase tracking-wider">Direct Expenses</span>
            <div className="p-1.5 rounded-lg bg-white/15">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>
            </div>
          </div>
          <div className="text-3xl font-extrabold">{directExpenseApprovals.length}</div>
          <div className="text-xs text-teal-100 mt-1">Direct expense requests</div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map(i => <div key={i} className="h-28 bg-white/80 rounded-2xl animate-pulse shadow-sm" />)}</div>
      ) : approvals.length === 0 ? (
        <Card>
          <div className="text-center py-12 text-slate-400">
            <div className="w-12 h-12 mx-auto mb-3 text-emerald-500 flex items-center justify-center">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
            </div>
            <p className="text-base font-semibold text-slate-700">All caught up!</p>
            <p className="text-sm mt-1">You have no pending requests requiring your approval at this time.</p>
          </div>
        </Card>
      ) : (
        <>
          {/* IOU Approvals */}
          {iouApprovals.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">IOU Initial Advance Approvals</h2>
              </div>
              {iouApprovals.map(a => (
                <ApprovalCard key={a.id} a={a} openModal={openModal} />
              ))}
            </div>
          )}

          {/* Expense Approvals */}
          {expenseApprovals.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                <h2 className="text-sm font-bold text-purple-800 uppercase tracking-wider">Expense Reconciliation Approvals</h2>
              </div>
              {expenseApprovals.map(a => (
                <ApprovalCard key={a.id} a={a} openModal={openModal} isExpense />
              ))}
            </div>
          )}

          {/* Direct Expense Approvals */}
          {directExpenseApprovals.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                <h2 className="text-sm font-bold text-teal-800 uppercase tracking-wider">Direct Expense Approvals</h2>
              </div>
              {directExpenseApprovals.map(a => (
                <ApprovalCard key={a.id} a={a} openModal={openModal} isDirectExpense />
              ))}
            </div>
          )}
        </>
      )}

      {/* Decision Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => !deciding && setModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800 mb-1">Confirm {modal.decision}</h3>
            <div className="flex items-center gap-2 mb-2">
              {modal.approval_type === 'expense' && <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold">Expense</span>}
              {modal.approval_type === 'iou' && <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">IOU</span>}
              {modal.approval_type === 'direct_expense' && <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-700 font-bold">Direct Expense</span>}
            </div>
            {(modal.requestNumber || modal.iou) && (
              <p className="text-sm text-slate-600 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                {modal.approval_type === 'direct_expense' ? 'Direct Expense' : 'IOU'}: <strong className="text-slate-800">{modal.requestNumber || modal.iou?.request_number}</strong> &bull; {fmt(modal.amount ?? modal.iou?.estimated_amount, modal.currency || modal.iou?.currency)}
              </p>
            )}
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Comments (optional)</label>
              <textarea
                value={comments}
                onChange={e => setComments(e.target.value)}
                rows={3}
                placeholder="Add comments or justification..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm resize-none"
                autoFocus
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setModal(null)} disabled={deciding} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={confirm}
                disabled={deciding}
                className={`px-5 py-2 rounded-xl bg-gradient-to-r ${colors[modal.decision]} text-white font-bold text-sm shadow-md hover:shadow-lg disabled:opacity-50`}
              >
                {deciding ? 'Processing...' : `Confirm ${modal.decision}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ApprovalCard({ a, openModal, isExpense = false, isDirectExpense = false }) {
  // Determine the request entity based on type
  const requestEntity = isDirectExpense ? a.directExpense : a.iou;
  const requesterName = requestEntity?.requester?.display_name || requestEntity?.requester?.username || '-';
  const initials = requesterName
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  // Determine amount display
  let amountDisplay;
  if (isDirectExpense) {
    amountDisplay = fmt(a.directExpense?.amount, a.directExpense?.currency);
  } else if (isExpense && a.expense?.actual_amount) {
    amountDisplay = fmt(a.expense.actual_amount, a.iou?.currency);
  } else {
    amountDisplay = fmt(a.iou?.estimated_amount, a.iou?.currency);
  }

  // Determine link destination
  const linkTo = isDirectExpense ? `/direct-expenses/${a.direct_expense_id}` : `/ious/${a.iou_id}`;
  const requestNumber = isDirectExpense ? a.directExpense?.request_number : (a.iou?.request_number || a.iou_id);
  const department = requestEntity?.department || '-';
  const purpose = requestEntity?.purpose || '-';

  return (
    <Card>
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Link to={linkTo} className="text-base font-bold text-slate-800 hover:text-emerald-600 transition-colors">
              {requestNumber}
            </Link>
            <span className="text-xs px-2.5 py-0.5 rounded-md bg-slate-100 font-mono text-slate-600 font-medium">
              Step {a.step_order}
            </span>
            {isDirectExpense ? (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 font-semibold">
                Direct Expense
              </span>
            ) : isExpense ? (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 font-semibold">
                Expense Review
              </span>
            ) : (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold">
                Advance Request
              </span>
            )}
          </div>
          {requestEntity && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-slate-600 mt-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-7 h-7 rounded-full ${isDirectExpense ? 'bg-gradient-to-tr from-teal-600 to-cyan-600' : 'bg-gradient-to-tr from-indigo-600 to-blue-600'} text-white font-bold flex items-center justify-center text-[10px] shrink-0 shadow-sm`}>
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Requester</div>
                  <div className="font-bold text-slate-800 truncate" title={requesterName}>
                    {requesterName}
                  </div>
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                  {isExpense ? 'Actual Amount' : 'Amount'}
                </div>
                <div className="font-extrabold text-emerald-700 whitespace-nowrap text-sm">
                  {amountDisplay}
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Department</div>
                <div className="font-semibold text-slate-700 truncate" title={department}>
                  {department}
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Purpose</div>
                <div className="font-medium text-slate-600 truncate" title={purpose}>
                  {purpose}
                </div>
              </div>
            </div>
          )}
          {a.comments && (
            <div className="mt-3 p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700">
              <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] block mb-0.5">Prior Comment:</span>
              "{a.comments}"
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
          <button
            onClick={() => openModal(a, 'APPROVED')}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-semibold text-xs shadow-md hover:shadow-lg transition-all"
          >
            Approve
          </button>
          <button
            onClick={() => openModal(a, 'RETURNED')}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 text-white font-semibold text-xs shadow-md hover:shadow-lg transition-all"
          >
            Return
          </button>
          <button
            onClick={() => openModal(a, 'REJECTED')}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 text-white font-semibold text-xs shadow-md hover:shadow-lg transition-all"
          >
            Reject
          </button>
        </div>
      </div>
    </Card>
  );
}
