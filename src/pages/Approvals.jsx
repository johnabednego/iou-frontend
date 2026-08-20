import React, { useEffect, useState } from 'react';
import { getMyApprovals, decideApproval } from '../services/iouService';
import Card from '../components/ui/Card';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';

function fmt(n, currency = 'GHS') {
  if (n == null) return `${currency} 0.00`;
  const localeMap = { GHS: 'en-GH', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB' };
  return new Intl.NumberFormat(localeMap[currency] || 'en-US', { style: 'currency', currency }).format(n);
}

export default function Approvals() {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [comments, setComments] = useState('');
  const [deciding, setDeciding] = useState(false);

  async function load() {
    setLoading(true);
    try { const r = await getMyApprovals(); setApprovals(r.data.data || []); }
    catch { setApprovals([]); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function openModal(a, decision) { setModal({ id: a.id, decision, iou: a.iou, approval_type: a.approval_type || 'iou' }); setComments(''); }

  async function confirm() {
    if (!modal) return;
    setDeciding(true);
    try {
      await decideApproval(modal.id, { decision: modal.decision, comments });
      setApprovals(a => a.filter(x => x.id !== modal.id));
      setModal(null);
      toast.success(`Decision recorded: ${modal.decision}`);
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed'); }
    finally { setDeciding(false); }
  }

  const colors = { APPROVED:'from-emerald-500 to-emerald-700', RETURNED:'from-yellow-400 to-yellow-600', REJECTED:'from-red-500 to-red-700' };

  // Separate IOU and expense approvals
  const iouApprovals = approvals.filter(a => !a.approval_type || a.approval_type === 'iou');
  const expenseApprovals = approvals.filter(a => a.approval_type === 'expense');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">My Approvals</h2>
        <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-sm font-semibold">{approvals.length} pending</span>
      </div>

      {loading ? (
        <div className="space-y-3">{[0,1,2].map(i => <div key={i} className="h-24 bg-white/80 rounded-xl animate-pulse" />)}</div>
      ) : approvals.length === 0 ? (
        <Card><div className="text-center py-12 text-slate-500"><div className="text-4xl mb-2">✅</div><p>No pending approvals</p></div></Card>
      ) : (
        <>
          {/* IOU Approvals */}
          {iouApprovals.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">IOU Approvals</h3>
              {iouApprovals.map(a => (
                <ApprovalCard key={a.id} a={a} openModal={openModal} />
              ))}
            </div>
          )}

          {/* Expense Approvals */}
          {expenseApprovals.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-orange-600 uppercase tracking-wider">Expense Approvals (Authorizer)</h3>
              {expenseApprovals.map(a => (
                <ApprovalCard key={a.id} a={a} openModal={openModal} isExpense />
              ))}
            </div>
          )}
        </>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => !deciding && setModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800 mb-1">Confirm {modal.decision}</h3>
            <div className="flex items-center gap-2 mb-1">
              {modal.approval_type === 'expense' && <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-semibold">Expense</span>}
              {modal.approval_type === 'iou' && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">IOU</span>}
            </div>
            {modal.iou && <p className="text-sm text-slate-500 mb-4">IOU: <strong>{modal.iou.request_number}</strong> - {fmt(modal.iou.estimated_amount, modal.iou.currency)}</p>}
            <div className="mb-4">
              <label className="block text-sm text-slate-700 mb-1">Comments (optional)</label>
              <textarea value={comments} onChange={e => setComments(e.target.value)} rows={3} placeholder="Add comments..." className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200" autoFocus />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setModal(null)} disabled={deciding} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm">Cancel</button>
              <button onClick={confirm} disabled={deciding} className={`px-5 py-2 rounded-lg bg-gradient-to-r ${colors[modal.decision]} text-white font-semibold text-sm shadow-md`}>{deciding ? 'Processing...' : `Confirm ${modal.decision}`}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ApprovalCard({ a, openModal, isExpense = false }) {
  return (
    <Card>
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Link to={`/ious/${a.iou_id}`} className="text-lg font-semibold text-emerald-700 hover:underline">{a.iou?.request_number || a.iou_id}</Link>
            <span className="text-xs text-slate-400">Step {a.step_order}</span>
            {isExpense && <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-semibold">Expense</span>}
          </div>
          {a.iou && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><span className="text-slate-500">Requester: </span><span className="font-medium">{a.iou.requester?.display_name || '-'}</span></div>
              <div><span className="text-slate-500">Amount: </span><span className="font-medium">{fmt(a.iou.estimated_amount, a.iou.currency)}</span></div>
              <div><span className="text-slate-500">Dept: </span><span className="font-medium">{a.iou.department || '-'}</span></div>
              <div><span className="text-slate-500">Purpose: </span><span className="font-medium line-clamp-1">{a.iou.purpose || '-'}</span></div>
            </div>
          )}
          {a.comments && (
            <div className="mt-2.5 p-2 bg-slate-50 rounded border border-slate-200 text-xs text-slate-700">
              <span className="font-semibold text-slate-500 uppercase tracking-wider">Comment: </span>"{a.comments}"
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => openModal(a,'APPROVED')} className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-700 text-white font-semibold text-sm shadow-md hover:shadow-lg transition">Approve</button>
          <button onClick={() => openModal(a,'RETURNED')} className="px-4 py-2 rounded-lg bg-gradient-to-r from-yellow-400 to-yellow-600 text-white font-semibold text-sm shadow-md hover:shadow-lg transition">Return</button>
          <button onClick={() => openModal(a,'REJECTED')} className="px-4 py-2 rounded-lg bg-gradient-to-r from-red-500 to-red-700 text-white font-semibold text-sm shadow-md hover:shadow-lg transition">Reject</button>
        </div>
      </div>
    </Card>
  );
}
