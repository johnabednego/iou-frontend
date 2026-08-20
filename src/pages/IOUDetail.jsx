import React, { useEffect, useState, useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getIOU, submitIOU, assignApprovers as assignApproversApi,
  updateIOU, confirmApproval as confirmApprovalApi,
  disburseIOU, confirmDisbursement as confirmDisbursementApi,
  submitExpense, updateExpense as updateExpenseApi, rejectExpense as rejectExpenseApi,
  assignExpenseApprovers as assignExpenseApproversApi, decideExpenseApproval as decideExpenseApprovalApi,
  reconcileIOU, redeemIOU,
  getDisbursements, getExpense, getUsers, decideApproval as decideApprovalApi, listApprovers as listApproversApi,
  cashierRejectIOU as cashierRejectIOUApi, cashierReturnIOU as cashierReturnIOUApi
} from '../services/iouService';
import { toast as toastify } from 'react-toastify';
import api from '../services/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import FileUploader from '../components/ui/FileUploader';
import { AuthContext } from '../contexts/AuthContext';

/* ── Status Badge ── */
function StatusBadge({ status }) {
  const s = (status || '').toUpperCase();
  const colors = {
    DRAFT: 'bg-slate-100 text-slate-700', PENDING: 'bg-amber-100 text-amber-800',
    PENDING_HOD_ASSIGNMENT: 'bg-indigo-100 text-indigo-800',
    APPROVED_FOR_DISBURSEMENT: 'bg-emerald-100 text-emerald-800',
    DISBURSED: 'bg-blue-100 text-blue-800',
    DISBURSEMENT_CONFIRMED: 'bg-blue-200 text-blue-900',
    EXPENSE_PENDING_APPROVAL: 'bg-orange-100 text-orange-800',
    EXPENSE_SUBMITTED: 'bg-purple-100 text-purple-800',
    EXPENSE_RETURNED: 'bg-yellow-100 text-yellow-800',
    RECONCILED: 'bg-teal-100 text-teal-800', REDEEMED: 'bg-green-100 text-green-800',
    RETURNED: 'bg-yellow-50 text-yellow-800',
    REJECTED: 'bg-red-100 text-red-700'
  };
  const label = s === 'PENDING_HOD_ASSIGNMENT' ? 'Awaiting Approver Assignment' : s.replace(/_/g, ' ');
  return <span className={`px-3 py-1 rounded-full text-xs font-semibold ${colors[s] || 'bg-slate-100 text-slate-700'}`}>{label}</span>;
}

function formatCurrency(n, currency = 'GHS') {
  if (n == null) return `${currency} 0.00`;
  const localeMap = { GHS: 'en-GH', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB' };
  return new Intl.NumberFormat(localeMap[currency] || 'en-US', { style: 'currency', currency }).format(n);
}

function shortDate(dt) {
  if (!dt) return '-';
  return new Date(dt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* ── Status Timeline ── */
const TIMELINE_STEPS = ['DRAFT', 'PENDING_HOD_ASSIGNMENT', 'PENDING', 'APPROVED_FOR_DISBURSEMENT', 'DISBURSED', 'DISBURSEMENT_CONFIRMED', 'EXPENSE_PENDING_APPROVAL', 'EXPENSE_SUBMITTED', 'RECONCILED', 'REDEEMED'];
const STEP_LABELS = {
  DRAFT: 'Draft', PENDING_HOD_ASSIGNMENT: 'Assign Approvers', PENDING: 'Pending Approval',
  APPROVED_FOR_DISBURSEMENT: 'Approved',
  DISBURSED: 'Disbursed', DISBURSEMENT_CONFIRMED: 'Funds Confirmed',
  EXPENSE_PENDING_APPROVAL: 'Expense Approval', EXPENSE_SUBMITTED: 'Expense Submitted',
  RECONCILED: 'Reconciled', REDEEMED: 'Redeemed'
};

function StatusTimeline({ currentStatus }) {
  const s = (currentStatus || '').toUpperCase();
  const isTerminal = ['REJECTED', 'RETURNED', 'CANCELLED', 'EXPENSE_RETURNED'].includes(s);
  const currentIdx = TIMELINE_STEPS.indexOf(s);

  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2">
      {TIMELINE_STEPS.map((step, idx) => {
        const isActive = idx === currentIdx;
        const isDone = currentIdx > idx;
        return (
          <React.Fragment key={step}>
            {idx > 0 && <div className={`h-0.5 w-6 flex-shrink-0 ${isDone ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium flex-shrink-0 transition
              ${isActive ? 'bg-emerald-500 text-white shadow-md' : isDone ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'}`}>
              {isDone && <span>✓</span>}
              {STEP_LABELS[step] || step}
            </div>
          </React.Fragment>
        );
      })}
      {isTerminal && (
        <>
          <div className="h-0.5 w-6 bg-red-300 flex-shrink-0" />
          <div className="px-2.5 py-1.5 rounded-full text-xs font-medium bg-red-100 text-red-700 flex-shrink-0">{s.replace(/_/g, ' ')}</div>
        </>
      )}
    </div>
  );
}

/* ── Main IOUDetail ── */
export default function IOUDetail() {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const [iou, setIou] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [disbursements, setDisbursements] = useState([]);
  const [expense, setExpense] = useState(null);
  const [reconciliation, setReconciliation] = useState(null);
  const [expenseApprovals, setExpenseApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  // All feedback via react-toastify (no inline banner)
  const [isEditing, setIsEditing] = useState(false);
  const [editPurpose, setEditPurpose] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCurrency, setEditCurrency] = useState('GHS');

  // Approver name cache
  const [approverNames, setApproverNames] = useState({});

  async function load() {
    setLoading(true);

    try {
      const res = await getIOU(id);
      setIou(res.data.iou);
      setAttachments(res.data.attachments || []);
      setApprovals(res.data.approvals || []);

      const [disbRes, expRes] = await Promise.all([
        getDisbursements(id).catch(() => ({ data: { data: [] } })),
        getExpense(id).catch(() => ({ data: { data: null, expenseApprovals: [], reconciliation: null } }))
      ]);
      setDisbursements(disbRes.data.data || []);
      setExpense(expRes.data.data || null);
      setReconciliation(expRes.data.reconciliation || expRes.data.data?.reconciliation || null);
      setExpenseApprovals(expRes.data.expenseApprovals || []);

      // Resolve approver names
      const allApprovals = [...(res.data.approvals || []), ...(expRes.data.expenseApprovals || [])];
      const approverIds = allApprovals.map(a => a.approver_id).filter(Boolean);
      const uniqueIds = [...new Set(approverIds)];
      const names = { ...approverNames };
      for (const uid of uniqueIds) {
        if (!names[uid]) {
          try {
            const uRes = await api.get(`/users/${uid}`);
            names[uid] = uRes.data.user?.display_name || uRes.data.user?.username || uid;
          } catch { names[uid] = uid; }
        }
      }
      setApproverNames(names);
    } catch (err) {
      console.error(err);
      toastify.error(err?.response?.data?.message || 'Failed to load IOU');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function handleAction(action, data = {}) {
    setActionLoading(true);

    try {
      let response;
      if (action === 'submit') response = await submitIOU(id);
      else if (action === 'disburse') response = await disburseIOU(id, data);
      else if (action === 'confirmDisbursement') response = await confirmDisbursementApi(id);
      else if (action === 'expense') response = await submitExpense(id, data);
      else if (action === 'updateExpense') response = await updateExpenseApi(id, data);
      else if (action === 'rejectExpense') response = await rejectExpenseApi(id, data);
      else if (action === 'reconcile') response = await reconcileIOU(id, data);
      else if (action === 'redeem') response = await redeemIOU(id, data);
      toastify.success(response?.data?.message || `${action} completed successfully!`);
      await load();
    } catch (err) {
      toastify.error(err?.response?.data?.message || `${action} failed. Please try again.`);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return (
    <div className="space-y-4">
      {[0, 1, 2].map(i => <div key={i} className="h-32 bg-white/80 rounded-xl animate-pulse" />)}
    </div>
  );

  if (!iou) return <Card>IOU not found</Card>;

  const isOwner = user?.id === iou.requester_id;
  const isCashier = user?.is_admin || user?.role === 'cashier';
  const status = (iou.status || '').toUpperCase();

  return (
    <div className="space-y-5 max-w-4xl mx-auto">


      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link to="/ious" className="text-sm text-slate-500 hover:text-slate-700">← Back to Requests</Link>
          <h2 className="text-2xl font-bold text-slate-800 mt-1">{iou.request_number}</h2>
        </div>
        <StatusBadge status={iou.status} />
      </div>

      {/* Returned Request Banner */}
      {status === 'RETURNED' && (() => {
        const returnedApproval = [...approvals].reverse().find(a => a.decision === 'RETURNED' && a.comments);
        return (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-800 mb-1">
            <p className="font-semibold">↩ This request has been returned for edits.</p>
            {returnedApproval?.comments && (
              <div className="mt-2 p-3 bg-yellow-100/60 rounded-lg border border-yellow-200">
                <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wider mb-1">Reason</p>
                <p className="text-sm text-yellow-900">"{returnedApproval.comments}"</p>
                {returnedApproval.decision_at && <p className="text-xs text-yellow-600 mt-1">- {approverNames[returnedApproval.approver_id] || 'Approver'}, {shortDate(returnedApproval.decision_at)}</p>}
              </div>
            )}
            <p className="mt-2">Please update the purpose or estimated amount below, modify attachments, and click "Save Changes" before re-submitting it for approval.</p>
          </div>
        );
      })()}

      {/* Rejected Request Banner */}
      {status === 'REJECTED' && (() => {
        const rejectedApproval = [...approvals].reverse().find(a => a.decision === 'REJECTED' && a.comments);
        return rejectedApproval?.comments ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800 mb-1">
            <p className="font-semibold">✕ This request has been rejected.</p>
            <div className="mt-2 p-3 bg-red-100/60 rounded-lg border border-red-200">
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-1">Reason</p>
              <p className="text-sm text-red-900">"{rejectedApproval.comments}"</p>
              {rejectedApproval.decision_at && <p className="text-xs text-red-600 mt-1">- {approverNames[rejectedApproval.approver_id] || 'Approver'}, {shortDate(rejectedApproval.decision_at)}</p>}
            </div>
          </div>
        ) : null;
      })()}

      {/* Timeline */}
      <Card>
        <h4 className="text-sm font-semibold text-slate-500 mb-2">Progress</h4>
        <StatusTimeline currentStatus={iou.status} />
      </Card>

      {/* IOU Details */}
      <Card title="IOU Details" action={
        (isOwner && ['DRAFT', 'RETURNED'].includes(status) && !isEditing) && (
          <button onClick={() => {
            setIsEditing(true);
            setEditPurpose(iou.purpose || '');
            setEditAmount(iou.estimated_amount || '');
            setEditCurrency(iou.currency || 'GHS');
          }} className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition">Edit Details</button>
        )
      }>
        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Purpose *</label>
              <textarea
                value={editPurpose}
                onChange={e => setEditPurpose(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Estimated Amount ({editCurrency}) *</label>
              <input
                type="number"
                step="0.01"
                value={editAmount}
                onChange={e => setEditAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Currency *</label>
              <select
                value={editCurrency}
                onChange={e => setEditCurrency(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm font-medium bg-white"
              >
                <option value="GHS">GHS &ndash; Ghana Cedi</option>
                <option value="USD">USD &ndash; US Dollar</option>
                <option value="EUR">EUR &ndash; Euro</option>
                <option value="GBP">GBP &ndash; British Pound</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button onClick={async () => {
                if (!editPurpose.trim()) {
                  toastify.error('Purpose is required');
                  return;
                }
                if (!editAmount || isNaN(editAmount) || Number(editAmount) <= 0) {
                  toastify.error('Enter a valid amount greater than 0');
                  return;
                }
                setActionLoading(true);

                try {
                  const res = await updateIOU(id, {
                    purpose: editPurpose,
                    estimated_amount: Number(editAmount),
                    currency: editCurrency,
                    attachments: attachments
                  });
                  setIou(res.data.iou);
                  setAttachments(res.data.attachments || []);
                  setIsEditing(false);
                  toastify.success('IOU details updated successfully!');
                } catch (err) {
                  toastify.error(err?.response?.data?.message || 'Failed to update details');
                } finally {
                  setActionLoading(false);
                }
              }} disabled={actionLoading}>
                {actionLoading ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button variant="secondary" onClick={() => setIsEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <DetailItem label="Purpose" value={iou.purpose || '-'} />
            <DetailItem label="Estimated Amount" value={formatCurrency(iou.estimated_amount, iou.currency)} />
            <DetailItem label="Currency" value={iou.currency || 'GHS'} />
            <DetailItem label="Department" value={iou.department || '-'} />
            <DetailItem label="Created" value={shortDate(iou.created_at)} />
            <DetailItem label="Submitted" value={shortDate(iou.submitted_at)} />
            {iou.ifs_voucher_number && (
              <DetailItem
                label="IFS Voucher Number"
                value={
                  <a
                    href={'https://ifsprod.apmterminals.com/client/runtime/Ifs.Fnd.Explorer.application'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline inline-flex items-center gap-1 font-semibold"
                  >
                    {iou.ifs_voucher_number}
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  </a>
                }
              />
            )}
          </div>
        )}
      </Card>

      {/* Approval Chain - IOU approvals only (expense approvals have their own section below) */}
      <Card title="Approval Chain">
        {(() => {
          const iouApprovals = approvals.filter(a => !a.approval_type || a.approval_type === 'iou');
          if (iouApprovals.length === 0) {
            return <p className="text-sm text-slate-500">{['PENDING', 'PENDING_HOD_ASSIGNMENT'].includes(status) ? 'Awaiting approver assignment by Cashier' : 'No approvers assigned yet'}</p>;
          }
          return (
            <div className="space-y-3">
              {iouApprovals.map(app => {
                const isMyApproval = user?.id === app.approver_id && app.decision === 'PENDING';
                const isMyTurn = isMyApproval && !iouApprovals.some(a => a.step_order < app.step_order && a.decision === 'PENDING');
                const canAct = isMyTurn && !isOwner;
                return (
                  <div key={app.id} className={`p-3 rounded-lg border ${canAct ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-300/50' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                          ${app.decision === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : app.decision === 'REJECTED' ? 'bg-red-100 text-red-700' : app.decision === 'RETURNED' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-200 text-slate-600'}`}>
                          {app.step_order}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{approverNames[app.approver_id] || app.approver_id}</div>
                          <div className="text-xs text-slate-500">Step {app.step_order}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-medium ${app.decision === 'APPROVED' ? 'text-emerald-600' : app.decision === 'REJECTED' ? 'text-red-600' : app.decision === 'RETURNED' ? 'text-yellow-600' : 'text-amber-500'}`}>
                          {app.decision}
                        </div>
                        {app.decision_at && <div className="text-xs text-slate-400">{shortDate(app.decision_at)}</div>}
                      </div>
                    </div>
                    {app.comments && (
                      <div className="mt-2 p-2.5 bg-slate-100 rounded-lg border border-slate-200">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Comment</p>
                        <p className="text-sm text-slate-700">"{app.comments}"</p>
                      </div>
                    )}
                    {canAct && (
                      <InlineApprovalActions approvalId={app.id} iouId={id} onDecided={load} />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </Card>

      {/* Attachments */}
      <Card title="Attachments">
        {(isOwner && ['DRAFT', 'RETURNED'].includes(status)) && (
          <div className="mb-3">
            <FileUploader iouId={iou.id} onUploaded={(a) => setAttachments(s => [...s, a])} />
          </div>
        )}
        {attachments.length === 0 ? (
          <p className="text-sm text-slate-500">No attachments</p>
        ) : (
          <div className="space-y-2">
            {attachments.map(a => (
              <div key={a.id} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                  <span className="text-sm">{a.file_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <a href="#" onClick={async (e) => { e.preventDefault(); try { const r = await api.get(`/uploads/${a.id}/download`); window.open(r.data.url); } catch (err) { toastify.error('Failed to download file'); } }} className="text-blue-600 text-sm hover:underline">Download</a>
                  {isOwner && ['DRAFT', 'RETURNED'].includes(status) && (
                    <button onClick={async () => { try { await api.delete(`/uploads/${a.id}`); setAttachments(s => s.filter(x => x.id !== a.id)); toastify.success('Attachment removed'); } catch (err) { toastify.error('Failed to delete'); } }} className="text-red-400 text-sm hover:text-red-600">Remove</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Disbursement Info */}
      {disbursements.length > 0 && (
        <Card title="Disbursement">
          {disbursements.map(d => (
            <div key={d.id} className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-blue-50 rounded-lg">
              <DetailItem label="Amount" value={formatCurrency(d.amount, iou.currency)} />
              <DetailItem label="Method" value={d.payment_method || '-'} />
              <DetailItem label="Reference" value={d.payment_reference || '-'} />
              <DetailItem label="Disbursed" value={shortDate(d.disbursed_at)} />
              {d.cashier && <DetailItem label="Cashier" value={d.cashier.display_name || d.cashier.username} />}
              <DetailItem label="Confirmed" value={d.confirmed_by_user ? `✓ ${shortDate(d.confirmed_at)}` : 'Not yet'} />
            </div>
          ))}
        </Card>
      )}

      {/* Req 7: Confirm Disbursement button */}
      {isOwner && status === 'DISBURSED' && (
        <Card title="Confirm Receipt of Funds">
          <p className="text-sm text-slate-600 mb-3">Please confirm that you have received the disbursed funds.</p>
          <Button onClick={() => handleAction('confirmDisbursement')} disabled={actionLoading}>
            {actionLoading ? 'Confirming...' : '✓ Confirm - I received the funds'}
          </Button>
        </Card>
      )}

      {/* Expense Info - shows estimated, actual, and difference */}
      {expense && (() => {
        const estimated = parseFloat(iou.estimated_amount) || 0;
        const actual = parseFloat(expense.actual_amount) || 0;
        const diff = actual - estimated;
        return (
          <Card title="Expense Submission">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-purple-50 rounded-lg">
              <DetailItem label="Estimated Amount" value={formatCurrency(estimated, iou.currency)} />
              <DetailItem label="Actual Amount" value={formatCurrency(actual, iou.currency)} />
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wider">Difference</div>
                <div className={`text-sm font-semibold mt-0.5 ${diff > 0 ? 'text-red-600' : diff < 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                  {diff > 0 ? '+' : ''}{formatCurrency(diff, iou.currency)}
                  <span className="text-xs font-normal ml-1 opacity-75">{diff > 0 ? '(overspent)' : diff < 0 ? '(underspent)' : '(exact)'}</span>
                </div>
              </div>
              <DetailItem label="Submitted" value={shortDate(expense.submitted_at)} />
              <DetailItem label="Status" value={expense.status} />
              {expense.notes && <div className="col-span-full"><DetailItem label="Notes" value={expense.notes} /></div>}
            </div>
            {/* Expense Attachments */}
            {Array.isArray(expense.attachments) && expense.attachments.length > 0 && (
              <div className="mt-3">
                <h5 className="text-xs text-slate-500 uppercase tracking-wider mb-2">Expense Attachments</h5>
                <div className="space-y-1">
                  {expense.attachments.map((a, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 bg-purple-50/50 rounded border border-purple-100 text-sm">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                        <span>{a.file_name}</span>
                      </div>
                      {a.file_path && <a href={a.file_path} target="_blank" rel="noopener noreferrer" className="text-purple-600 text-sm hover:underline">View</a>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        );
      })()}

      {/* Expense Approval Chain - Req 12 */}
      {expenseApprovals.length > 0 && (
        <Card title="Expense Approval Chain">
          <div className="space-y-3">
            {expenseApprovals.map(app => {
              const isMyApproval = user?.id === app.approver_id && app.decision === 'PENDING';
              const isMyTurn = isMyApproval && !expenseApprovals.some(a => a.step_order < app.step_order && a.decision === 'PENDING');
              const canAct = isMyTurn && !isOwner;

              return (
                <div key={app.id} className={`p-3 rounded-lg border ${canAct ? 'bg-orange-50 border-orange-200 ring-2 ring-orange-300/50' : 'bg-slate-50 border-slate-100'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                        ${app.decision === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : app.decision === 'RETURNED' ? 'bg-yellow-100 text-yellow-700' : 'bg-orange-200 text-orange-700'}`}>
                        {app.step_order}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{approverNames[app.approver_id] || app.approver_id}</div>
                        <div className="text-xs text-slate-500">Authorizer Step {app.step_order}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-medium ${app.decision === 'APPROVED' ? 'text-emerald-600' : app.decision === 'RETURNED' ? 'text-yellow-600' : 'text-amber-500'}`}>
                        {app.decision}
                      </div>
                      {app.decision_at && <div className="text-xs text-slate-400">{shortDate(app.decision_at)}</div>}
                    </div>
                  </div>
                  {app.comments && (
                    <div className="mt-2 p-2.5 bg-slate-100 rounded-lg border border-slate-200">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Comment</p>
                      <p className="text-sm text-slate-700">"{app.comments}"</p>
                    </div>
                  )}
                  {canAct && (
                    <InlineApprovalActions approvalId={app.id} iouId={id} onDecided={load} isExpense={true} />
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ──── Action Panels ──── */}

      {/* Employee: Submit for approval */}
      {isOwner && ['DRAFT', 'RETURNED'].includes(status) && (
        <Card title="Submit for Approval">
          <p className="text-sm text-slate-600 mb-3">Submit this IOU to start the approval workflow. The Cashier will assign your Head of Department and approval chain.</p>
          <Button onClick={() => handleAction('submit')} disabled={actionLoading}>
            {actionLoading ? 'Submitting...' : 'Submit for Approval'}
          </Button>
        </Card>
      )}

      {/* Cashier: Assign Approvers (shown for PENDING_HOD_ASSIGNMENT + PENDING) */}
      {isCashier && ['PENDING_HOD_ASSIGNMENT', 'PENDING'].includes(status) && (
        <AssignApproversPanel iouId={id} requesterId={iou.requester_id} existingApprovals={approvals} approverNames={approverNames} onAssigned={load} iouStatus={status} onStatusChanged={load} />
      )}

      {/* Cashier: Confirm Approval - when all approvals are APPROVED */}
      {isCashier && status === 'PENDING' && approvals.length > 0 && approvals.every(a => a.decision === 'APPROVED') && (
        <Card title="Confirm Approval">
          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 mb-3">
            <p className="text-sm text-emerald-800 font-medium">✓ All {approvals.length} approver(s) have approved this IOU.</p>
            <p className="text-sm text-emerald-700 mt-1">Click below to finalize and move to disbursement.</p>
          </div>
          <Button onClick={async () => {
            setActionLoading(true);
            try {
              const res = await confirmApprovalApi(id);
              toastify.success(res?.data?.message || 'Approval confirmed!');
              await load();
            } catch (err) {
              toastify.error(err?.response?.data?.message || 'Failed to confirm');
            } finally { setActionLoading(false); }
          }} disabled={actionLoading}>
            {actionLoading ? 'Confirming...' : '✓ Confirm Approval - Proceed to Disbursement'}
          </Button>
        </Card>
      )}

      {/* Cashier: Disburse */}
      {isCashier && status === 'APPROVED_FOR_DISBURSEMENT' && (
        <DisbursePanel estimatedAmount={iou.estimated_amount} currency={iou.currency} onDisburse={(data) => handleAction('disburse', data)} loading={actionLoading} />
      )}

      {/* Employee: Submit Expense (Req 8: only after disbursement confirmed) */}
      {isOwner && status === 'DISBURSEMENT_CONFIRMED' && !expense && (
        <ExpensePanel currency={iou.currency} onSubmit={(data) => handleAction('expense', data)} loading={actionLoading} />
      )}

      {/* Req 13: Employee edits returned expense */}
      {isOwner && status === 'EXPENSE_RETURNED' && expense && (
        <EditExpensePanel expense={expense} expenseApprovals={expenseApprovals} approverNames={approverNames} currency={iou.currency} onSubmit={(data) => handleAction('updateExpense', data)} loading={actionLoading} />
      )}

      {/* Cashier: Assign Expense Approvers - Req 12 */}
      {isCashier && status === 'EXPENSE_PENDING_APPROVAL' && expense && (
        <AssignExpenseApproversPanel iouId={id} requesterId={iou.requester_id} existingApprovals={expenseApprovals} approverNames={approverNames} onAssigned={load} />
      )}

      {/* Cashier: Reject Expense - Req 11 */}
      {isCashier && status === 'EXPENSE_PENDING_APPROVAL' && expense && expense.status !== 'APPROVED' && (
        <RejectExpensePanel onReject={(data) => handleAction('rejectExpense', data)} loading={actionLoading} />
      )}

      {/* Cashier: Reconcile */}
      {isCashier && status === 'EXPENSE_SUBMITTED' && expense && (
        <ReconcilePanel iou={iou} expense={expense} currency={iou.currency} onReconcile={(data) => handleAction('reconcile', data)} loading={actionLoading} />
      )}

      {/* Owner or Cashier: Confirm Reconciliation */}
      {(isOwner || isCashier) && status === 'RECONCILED' && (
        <RedeemPanel
          iou={iou}
          expense={expense}
          reconciliation={reconciliation}
          disbursements={disbursements}
          onRedeem={(data) => handleAction('redeem', data)}
          loading={actionLoading}
          isOwner={isOwner}
          isCashier={isCashier}
        />
      )}
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div>
      <div className="text-xs text-slate-500 uppercase tracking-wider">{label}</div>
      <div className="text-sm font-medium text-slate-800 mt-0.5">{value}</div>
    </div>
  );
}

/* ── Inline Approval Action Buttons (Req 7) ── */
function InlineApprovalActions({ approvalId, iouId, onDecided, isExpense = false }) {
  const [deciding, setDeciding] = useState(false);
  const [showModal, setShowModal] = useState(null); // 'APPROVED'|'REJECTED'|'RETURNED'
  const [comments, setComments] = useState('');

  async function handleDecision(decision) {
    setDeciding(true);
    try {
      await decideApprovalApi(approvalId, { decision, comments });
      toastify.success(`Decision recorded: ${decision}`);
      setShowModal(null);
      setComments('');
      onDecided?.();
    } catch (err) {
      toastify.error(err?.response?.data?.message || 'Failed to record decision');
    } finally { setDeciding(false); }
  }

  return (
    <>
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-blue-200">
        <span className="text-xs text-blue-600 font-medium mr-2">Your turn:</span>
        <button onClick={() => setShowModal('APPROVED')} disabled={deciding} className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-700 text-white font-semibold text-xs shadow hover:shadow-md transition">Approve</button>
        <button onClick={() => setShowModal('RETURNED')} disabled={deciding} className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-yellow-400 to-yellow-600 text-white font-semibold text-xs shadow hover:shadow-md transition">Return</button>
        {!isExpense && <button onClick={() => setShowModal('REJECTED')} disabled={deciding} className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-red-500 to-red-700 text-white font-semibold text-xs shadow hover:shadow-md transition">Reject</button>}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => !deciding && setShowModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800 mb-3">Confirm {showModal}</h3>
            <div className="mb-4">
              <label className="block text-sm text-slate-700 mb-1">Comments {showModal !== 'APPROVED' ? <span className=' text-red-500'>*</span> : '(optional)'}</label>
              <textarea value={comments} onChange={e => setComments(e.target.value)} rows={3} placeholder="Add comments..." className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200" autoFocus />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowModal(null)} disabled={deciding} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm">Cancel</button>
              <button
                onClick={() => showModal !== 'APPROVED' && comments.length < 1 ? toastify.error("Comments are required") : handleDecision(showModal)}
                // disabled={deciding || (showModal !== 'APPROVED' && !comments.trim())}
                className={`px-5 py-2 rounded-lg text-white font-semibold text-sm shadow-md
                  ${showModal === 'APPROVED' ? 'bg-gradient-to-r from-emerald-500 to-emerald-700' : showModal === 'RETURNED' ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' : 'bg-gradient-to-r from-red-500 to-red-700'}`}
              >
                {deciding ? 'Processing...' : `Confirm ${showModal}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


/* ── Assign Approvers Panel - with validation + cashier reject/return ── */
function AssignApproversPanel({ iouId, requesterId, existingApprovals, approverNames, onAssigned, iouStatus, onStatusChanged }) {
  const occupiedApprovals = (existingApprovals || []).filter(a => a.approval_type === 'iou');
  const startStep = occupiedApprovals.length + 1;

  const [rows, setRows] = useState([{ approver_id: '', step_order: startStep, display_name: '' }]);
  const [hodUsers, setHodUsers] = useState([]);
  const [managedApprovers, setManagedApprovers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Cashier reject / return modal state
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [actionComments, setActionComments] = useState('');
  const [actioning, setActioning] = useState(false);

  useEffect(() => {
    setRows([{ approver_id: '', step_order: startStep, display_name: '' }]);
  }, [startStep]);

  useEffect(() => {
    async function loadEligibleUsers() {
      setLoadingUsers(true);
      try {
        const [hodRes, appRes] = await Promise.all([
          getUsers({ role: 'hod', is_active: true, limit: 200 }),
          listApproversApi()
        ]);
        setHodUsers(hodRes.data.data || []);
        setManagedApprovers(appRes.data.data || []);
      } catch (err) {
        console.error('Failed to load eligible approvers', err);
      } finally {
        setLoadingUsers(false);
      }
    }
    loadEligibleUsers();
  }, []);

  function removeRow(idx) {
    const remaining = rows.filter((_, i) => i !== idx);
    const recalculated = remaining.map((r, i) => ({ ...r, step_order: startStep + i }));
    setRows(recalculated.length > 0 ? recalculated : [{ approver_id: '', step_order: startStep, display_name: '' }]);
  }

  function addRow() {
    setRows(s => [...s, { approver_id: '', step_order: startStep + s.length, display_name: '' }]);
  }

  async function handleAssign() {
    const valid = rows.filter(r => r.approver_id);
    if (occupiedApprovals.length === 0 && valid.length === 0) {
      toastify.error('Please select at least one approver');
      return;
    }

    const allApprovers = [
      ...occupiedApprovals.map(a => ({ approver_id: a.approver_id, step_order: a.step_order })),
      ...valid.map(r => ({ approver_id: r.approver_id, step_order: r.step_order }))
    ];

    if (allApprovers.length === 0) {
      toastify.error('Please select at least one approver');
      return;
    }

    const ids = allApprovers.map(a => a.approver_id);
    if (new Set(ids).size !== ids.length) {
      toastify.error('Each approver can only be assigned once');
      return;
    }

    setSubmitting(true);
    try {
      await assignApproversApi(iouId, allApprovers);
      toastify.success('Approvers assigned successfully!');
      onAssigned && onAssigned();
    } catch (err) {
      toastify.error(err?.response?.data?.message || 'Failed to assign approvers');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCashierAction(type) {
    if (!actionComments.trim()) {
      toastify.error('A reason/comment is required');
      return;
    }
    setActioning(true);
    try {
      if (type === 'reject') {
        await cashierRejectIOUApi(iouId, { comments: actionComments });
        toastify.success('IOU rejected successfully.');
      } else {
        await cashierReturnIOUApi(iouId, { comments: actionComments });
        toastify.success('IOU returned to requester for edits.');
      }
      setShowRejectModal(false);
      setShowReturnModal(false);
      setActionComments('');
      onStatusChanged?.();
    } catch (err) {
      toastify.error(err?.response?.data?.message || `Failed to ${type} IOU`);
    } finally {
      setActioning(false);
    }
  }

  const selectedIds = new Set(rows.map(r => r.approver_id).filter(Boolean));
  occupiedApprovals.forEach(a => { if (a.approver_id) selectedIds.add(a.approver_id); });

  return (
    <>
      <Card title="Assign Approvers">
        {/* Show Occupied Steps */}
        {occupiedApprovals.length > 0 && (
          <div className="space-y-2 mb-4 border-b border-slate-100 pb-4">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Occupied Approval Steps:</div>
            {occupiedApprovals.map(a => {
              const name = (approverNames && approverNames[a.approver_id]) || a.approver_id;
              return (
                <div key={a.id} className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-sm font-bold flex-shrink-0">{a.step_order}</div>
                  <div className="flex-1 flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-sm font-medium text-slate-800">{name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-semibold ${a.decision === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'}`}>
                      {a.decision === 'PENDING' ? 'Occupied (Pending)' : `Occupied (${a.decision})`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-sm text-slate-600 mb-3">
          {occupiedApprovals.length === 0
            ? 'Assign the Head of Department as Step 1, then additional approvers from the Approvers list in order. Only the first pending approver will be notified.'
            : `Assign additional approvers from the Approvers list in order (starting from Step ${startStep}). Only the next pending approver will be notified.`
          }
        </p>

        <div className="space-y-3">
          {rows.map((r, idx) => {
            const isStep1 = r.step_order === 1 && occupiedApprovals.length === 0;
            const pool = isStep1 ? hodUsers : managedApprovers;
            const options = pool.filter(u => u.id !== requesterId && (u.id === r.approver_id || !selectedIds.has(u.id)));

            return (
              <div key={idx} className="flex items-center gap-2 relative">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold flex-shrink-0">{r.step_order}</div>
                <div className="flex-1">
                  <select
                    value={r.approver_id || ''}
                    disabled={loadingUsers}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const foundUser = pool.find(u => u.id === selectedId);
                      const c = [...rows];
                      c[idx] = {
                        ...c[idx],
                        approver_id: selectedId,
                        display_name: foundUser ? (foundUser.display_name || foundUser.username) : ''
                      };
                      setRows(c);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm bg-white cursor-pointer"
                  >
                    <option value="">
                      {loadingUsers ? 'Loading approvers...' : (isStep1 ? '-- Select Head of Department --' : '-- Select Approver --')}
                    </option>
                    {options.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.display_name || u.username} {u.department ? `(${u.department})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                {rows.length > 1 && (
                  <button onClick={() => removeRow(idx)} className="text-red-400 hover:text-red-600 text-sm flex-shrink-0">Remove</button>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={addRow} className="px-3 py-2 bg-white rounded-lg border border-slate-200 text-sm hover:bg-slate-50">+ Add Approver</button>
          <Button onClick={handleAssign} disabled={submitting || (occupiedApprovals.length === 0 && rows.every(r => !r.approver_id))}>
            {submitting ? 'Assigning...' : 'Assign Approvers'}
          </Button>
        </div>

        {/* Cashier: Reject or Return - only available before approvers are assigned */}
        {iouStatus === 'PENDING_HOD_ASSIGNMENT' && (
          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-3">Or take an alternative action:</p>
            <div className="flex flex-wrap gap-2">
              <button
                id="btn-cashier-return-iou"
                onClick={() => { setActionComments(''); setShowReturnModal(true); }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                Return for Edits
              </button>
              <button
                id="btn-cashier-reject-iou"
                onClick={() => { setActionComments(''); setShowRejectModal(true); }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                Reject Request
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* ── Return Modal ── */}
      {showReturnModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => !actioning && setShowReturnModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Return IOU for Edits</h3>
                <p className="text-sm text-slate-500 mt-0.5">The requester will be notified and can edit and re-submit.</p>
              </div>
            </div>
            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-700 mb-1">Reason / Comments <span className="text-red-500">*</span></label>
              <textarea
                value={actionComments}
                onChange={e => setActionComments(e.target.value)}
                rows={3}
                placeholder="Explain why this IOU needs changes before it can be approved..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-200 text-sm resize-none"
                autoFocus
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowReturnModal(false)} disabled={actioning} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition">Cancel</button>
              <button
                onClick={() => handleCashierAction('return')}
                disabled={actioning || !actionComments.trim()}
                className="px-5 py-2 rounded-lg text-white font-semibold text-sm shadow-md bg-gradient-to-r from-amber-400 to-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {actioning ? 'Processing...' : '↩ Confirm Return'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject Modal ── */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => !actioning && setShowRejectModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Reject IOU Request</h3>
                <p className="text-sm text-slate-500 mt-0.5">This is a permanent action. The requester will be notified of the rejection.</p>
              </div>
            </div>
            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-700 mb-1">Reason / Comments <span className="text-red-500">*</span></label>
              <textarea
                value={actionComments}
                onChange={e => setActionComments(e.target.value)}
                rows={3}
                placeholder="Explain why this IOU is being rejected..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-200 text-sm resize-none"
                autoFocus
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowRejectModal(false)} disabled={actioning} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition">Cancel</button>
              <button
                onClick={() => handleCashierAction('reject')}
                disabled={actioning || !actionComments.trim()}
                className="px-5 py-2 rounded-lg text-white font-semibold text-sm shadow-md bg-gradient-to-r from-red-500 to-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {actioning ? 'Processing...' : '✕ Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Disburse Panel ── */
function DisbursePanel({ estimatedAmount, currency = 'GHS', onDisburse, loading }) {
  const [method, setMethod] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [methodError, setMethodError] = useState('');

  function handleSubmit() {
    if (!method) {
      setMethodError('Payment Method is required');
      return;
    }
    setMethodError('');
    onDisburse({ amount: Number(estimatedAmount), payment_method: method, payment_reference: reference, notes });
  }

  return (
    <Card title="Disburse Funds">
      <p className="text-sm text-slate-600 mb-3">Record the disbursement for this approved IOU.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-slate-700 mb-1">Amount ({currency})</label>
          <div className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 select-none">
            {estimatedAmount
              ? formatCurrency(estimatedAmount, currency)
              : '-'}
          </div>
          <p className="text-xs text-slate-400 mt-1">Locked to approved estimated amount</p>
        </div>
        <div>
          <label className="block text-sm text-slate-700 mb-1">
            Payment Method <span className="text-red-500">*</span>
          </label>
          <select
            value={method}
            onChange={e => { setMethod(e.target.value); setMethodError(''); }}
            className={`w-full px-3 py-2 rounded-lg border text-sm ${methodError ? 'border-red-400 focus:ring-red-200' : 'border-slate-200 focus:ring-blue-200'} focus:outline-none focus:ring-2`}
          >
            <option value="">Select payment method...</option>
            <option value="CASH">Cash</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="MOBILE_MONEY">Mobile Money</option>
            <option value="CHEQUE">Cheque</option>
          </select>
          {methodError && <p className="text-red-500 text-xs mt-1">{methodError}</p>}
        </div>
        <div>
          <label className="block text-sm text-slate-700 mb-1">Payment Reference</label>
          <input value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. TXN-12345" className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm" />
        </div>
        <div>
          <label className="block text-sm text-slate-700 mb-1">Notes</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm" />
        </div>
      </div>
      <div className="mt-4">
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? 'Processing...' : 'Confirm Disbursement'}
        </Button>
      </div>
    </Card>
  );
}


/* ── Expense Submission Panel - Req 9: attachments required ── */
function ExpensePanel({ currency = 'GHS', onSubmit, loading }) {
  const [actualAmount, setActualAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [expAttachments, setExpAttachments] = useState([]);
  const [error, setError] = useState('');

  function handleSubmit() {
    if (!actualAmount) { setError('Actual amount is required'); return; }
    if (expAttachments.length === 0) { setError('At least one attachment (receipt/supporting document) is required'); return; }
    setError('');
    onSubmit({
      actual_amount: Number(actualAmount), notes,
      attachments: expAttachments.map(a => ({ file_name: a.file_name, file_path: a.file_path, blob_name: a.blob_name, content_type: a.content_type, size: a.size }))
    });
  }

  return (
    <Card title="Submit Expense">
      <p className="text-sm text-slate-600 mb-3">Submit your actual expense with supporting documents.</p>
      {error && <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>}
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-slate-700 mb-1">Actual Amount ({currency}) *</label>
          <input type="number" step="0.01" value={actualAmount} onChange={e => setActualAmount(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200" />
        </div>
        <div>
          <label className="block text-sm text-slate-700 mb-1">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200" />
        </div>
        <div>
          <label className="block text-sm text-slate-700 mb-1">Receipt / Supporting Documents *</label>
          <FileUploader onUploaded={(att) => setExpAttachments(s => [...s, att])} />
          {expAttachments.length > 0 && (
            <div className="mt-2 space-y-1">
              {expAttachments.map((a, i) => (
                <div key={i} className="text-sm text-slate-600 flex items-center justify-between">
                  <div className="flex items-center gap-1"><span className="text-emerald-500">✓</span> {a.file_name}</div>
                  <button onClick={() => setExpAttachments(s => s.filter((_, j) => j !== i))} className="text-red-400 text-xs hover:text-red-600">Remove</button>
                </div>
              ))}
            </div>
          )}
        </div>
        <Button onClick={handleSubmit} disabled={loading || !actualAmount}>
          {loading ? 'Submitting...' : 'Submit Expense'}
        </Button>
      </div>
    </Card>
  );
}

/* ── Edit Expense Panel - Req 13: edit returned expense with upload/remove ── */
function EditExpensePanel({ expense, expenseApprovals = [], approverNames = {}, currency = 'GHS', onSubmit, loading }) {
  const [actualAmount, setActualAmount] = useState(expense?.actual_amount || '');
  const [notes, setNotes] = useState(expense?.notes || '');
  const [expAttachments, setExpAttachments] = useState(expense?.attachments || []);
  const [error, setError] = useState('');

  const returnedApproval = [...expenseApprovals].reverse().find(a => (a.decision === 'RETURNED' || a.decision === 'REJECTED') && a.comments);

  function removeAttachment(idx) {
    setExpAttachments(s => s.filter((_, i) => i !== idx));
  }

  function handleSubmit() {
    if (!actualAmount) { setError('Actual amount is required'); return; }
    if (expAttachments.length === 0) { setError('At least one attachment is required'); return; }
    setError('');
    onSubmit({
      actual_amount: Number(actualAmount), notes,
      attachments: expAttachments.map(a => ({ file_name: a.file_name, file_path: a.file_path, blob_name: a.blob_name, content_type: a.content_type, size: a.size }))
    });
  }

  return (
    <Card title="Edit & Re-submit Expense">
      <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
        <p className="font-semibold">↩ Your expense submission was returned.</p>
        {returnedApproval?.comments ? (
          <div className="mt-2 p-2.5 bg-yellow-100/70 rounded border border-yellow-200 text-yellow-900">
            <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wider mb-0.5">Reason / Comments</p>
            <p className="text-sm">"{returnedApproval.comments}"</p>
            {returnedApproval.decision_at && <p className="text-xs text-yellow-600 mt-1">- {approverNames[returnedApproval.approver_id] || 'Approver'}, {shortDate(returnedApproval.decision_at)}</p>}
          </div>
        ) : (
          <p className="mt-1">Please make the necessary changes and re-submit.</p>
        )}
      </div>
      {error && <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>}
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-slate-700 mb-1">Actual Amount ({currency}) *</label>
          <input type="number" step="0.01" value={actualAmount} onChange={e => setActualAmount(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200" />
        </div>
        <div>
          <label className="block text-sm text-slate-700 mb-1">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200" />
        </div>
        <div>
          <label className="block text-sm text-slate-700 mb-1">Attachments *</label>
          {/* Show existing attachments with remove buttons */}
          {expAttachments.length > 0 && (
            <div className="mb-2 space-y-1">
              {expAttachments.map((a, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded border border-slate-100 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-500">✓</span>
                    <span>{a.file_name}</span>
                  </div>
                  <button onClick={() => removeAttachment(i)} className="text-red-400 text-xs hover:text-red-600">Remove</button>
                </div>
              ))}
            </div>
          )}
          {/* Upload new attachments */}
          <FileUploader onUploaded={(att) => setExpAttachments(s => [...s, att])} />
        </div>
        <Button onClick={handleSubmit} disabled={loading || !actualAmount}>
          {loading ? 'Re-submitting...' : 'Re-submit Expense'}
        </Button>
      </div>
    </Card>
  );
}

/* ── Assign Expense Approvers Panel - with validation ── */
function AssignExpenseApproversPanel({ iouId, requesterId, existingApprovals, approverNames, onAssigned }) {
  const occupiedApprovals = (existingApprovals || []).filter(a => a.approval_type === 'expense');
  const startStep = occupiedApprovals.length + 1;

  const [rows, setRows] = useState([{ approver_id: '', step_order: startStep, display_name: '' }]);
  const [managedApprovers, setManagedApprovers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setRows([{ approver_id: '', step_order: startStep, display_name: '' }]);
  }, [startStep]);

  useEffect(() => {
    async function loadManagedApprovers() {
      setLoadingUsers(true);
      try {
        const res = await listApproversApi();
        setManagedApprovers(res.data.data || []);
      } catch (err) {
        console.error('Failed to load managed approvers', err);
      } finally {
        setLoadingUsers(false);
      }
    }
    loadManagedApprovers();
  }, []);

  function addRow() {
    setRows(s => [...s, { approver_id: '', step_order: startStep + s.length, display_name: '' }]);
  }

  function removeRow(idx) {
    const remaining = rows.filter((_, i) => i !== idx);
    const recalculated = remaining.map((r, i) => ({ ...r, step_order: startStep + i }));
    setRows(recalculated.length > 0 ? recalculated : [{ approver_id: '', step_order: startStep, display_name: '' }]);
  }

  async function handleAssign() {
    const valid = rows.filter(r => r.approver_id);
    if (valid.length === 0) { toastify.error('Please select at least one approver'); return; }

    const allApprovers = [
      ...occupiedApprovals.map(a => ({ approver_id: a.approver_id, step_order: a.step_order })),
      ...valid.map(r => ({ approver_id: r.approver_id, step_order: r.step_order }))
    ];

    const ids = allApprovers.map(a => a.approver_id);
    if (new Set(ids).size !== ids.length) {
      toastify.error('Each approver can only be assigned once');
      return;
    }

    setSubmitting(true);
    try {
      await assignExpenseApproversApi(iouId, allApprovers);
      toastify.success('Authorizer approvers assigned!');
      onAssigned?.();
    } catch (err) {
      toastify.error(err?.response?.data?.message || 'Failed to assign');
    } finally { setSubmitting(false); }
  }

  const selectedIds = new Set(rows.map(r => r.approver_id).filter(Boolean));
  occupiedApprovals.forEach(a => { if (a.approver_id) selectedIds.add(a.approver_id); });

  return (
    <Card title="Assign Authorizer Approvers (Expense)">
      <p className="text-sm text-slate-600 mb-3">Assign authorizer team members to approve this expense:</p>

      {occupiedApprovals.length > 0 && (
        <div className="space-y-2 mb-4 border-b border-slate-100 pb-4">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Occupied Steps:</div>
          {occupiedApprovals.map(a => {
            const name = approverNames[a.approver_id] || a.approver_id;
            return (
              <div key={a.id} className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-sm font-bold flex-shrink-0">{a.step_order}</div>
                <div className="flex-1 flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-sm font-medium text-slate-800">{name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded font-semibold ${a.decision === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'}`}>
                    {a.decision === 'PENDING' ? 'Occupied (Pending)' : `Occupied (${a.decision})`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-3">
        {rows.map((r, idx) => {
          const options = managedApprovers.filter(u => u.id !== requesterId && (u.id === r.approver_id || !selectedIds.has(u.id)));

          return (
            <div key={idx} className="flex items-center gap-2 relative">
              <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-sm font-bold flex-shrink-0">{r.step_order}</div>
              <div className="flex-1">
                <select
                  value={r.approver_id || ''}
                  disabled={loadingUsers}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    const foundUser = managedApprovers.find(u => u.id === selectedId);
                    const c = [...rows];
                    c[idx] = {
                      ...c[idx],
                      approver_id: selectedId,
                      display_name: foundUser ? (foundUser.display_name || foundUser.username) : ''
                    };
                    setRows(c);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-200 text-sm bg-white cursor-pointer"
                >
                  <option value="">
                    {loadingUsers ? 'Loading approvers...' : '-- Select Authorizer Approver --'}
                  </option>
                  {options.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.display_name || u.username} {u.department ? `(${u.department})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              {rows.length > 1 && <button onClick={() => removeRow(idx)} className="text-red-400 hover:text-red-600 text-sm flex-shrink-0">Remove</button>}
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={addRow} className="px-3 py-2 bg-white rounded-lg border border-slate-200 text-sm hover:bg-slate-50">+ Add Approver</button>
        <Button onClick={handleAssign} disabled={submitting || rows.every(r => !r.approver_id)}>
          {submitting ? 'Assigning...' : 'Assign Authorizer Approvers'}
        </Button>
      </div>
    </Card>
  );
}

/* ── Reject Expense Panel - Req 11 ── */
function RejectExpensePanel({ onReject, loading }) {
  const [reason, setReason] = useState('');

  return (
    <Card title="Reject / Return Expense">
      <p className="text-sm text-slate-600 mb-3">Return this expense to the requester for corrections.</p>
      <div className="mb-3">
        <label className="block text-sm text-slate-700 mb-1">Reason *</label>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="Explain why the expense is being returned..." className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-200" />
      </div>
      <Button onClick={() => onReject({ reason })} disabled={loading || !reason.trim()} className="bg-gradient-to-r from-red-500 to-red-700">
        {loading ? 'Processing...' : 'Return Expense'}
      </Button>
    </Card>
  );
}

/* ── Reconcile Panel ── */
function ReconcilePanel({ iou, expense, currency = 'GHS', onReconcile, loading }) {
  const [notes, setNotes] = useState('');
  const [ifsVoucherNumber, setIfsVoucherNumber] = useState('');
  const estimated = parseFloat(iou.estimated_amount) || 0;
  const actual = parseFloat(expense.actual_amount) || 0;
  const diff = actual - estimated;

  return (
    <Card title="Reconciliation">
      <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg mb-4">
        <div className="text-center">
          <div className="text-xs text-slate-500">Estimated</div>
          <div className="text-lg font-bold text-slate-800">{formatCurrency(estimated, currency)}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-slate-500">Actual</div>
          <div className="text-lg font-bold text-slate-800">{formatCurrency(actual, currency)}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-slate-500">Difference</div>
          <div className={`text-lg font-bold ${diff > 0 ? 'text-red-600' : diff < 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
            {diff > 0 ? '+' : ''}{formatCurrency(diff, currency)}
          </div>
          <div className="text-xs text-slate-400">{diff > 0 ? 'Overspent' : diff < 0 ? 'Underspent' : 'Exact match'}</div>
        </div>
      </div>
      <div className="mb-4">
        <label className="block text-sm text-slate-700 mb-1">IFS Voucher Number *</label>
        <input
          type="text"
          value={ifsVoucherNumber}
          onChange={e => setIfsVoucherNumber(e.target.value)}
          placeholder="e.g. 2026002038"
          className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm font-medium mb-3"
          required
        />
        <label className="block text-sm text-slate-700 mb-1">Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm" />
      </div>
      <Button
        onClick={() => {
          if (!ifsVoucherNumber.trim()) {
            toastify.error('IFS Voucher Number is required');
            return;
          }
          onReconcile({ notes, ifs_voucher_number: ifsVoucherNumber.trim() });
        }}
        disabled={loading || !ifsVoucherNumber.trim()}
      >
        {loading ? 'Reconciling...' : 'Confirm Reconciliation'}
      </Button>
    </Card>
  );
}

/* ── Redeem / Reconciliation Confirmation Panel ── */
function RedeemPanel({ iou, expense, reconciliation, disbursements, onRedeem, loading, isOwner, isCashier }) {
  const [notes, setNotes] = useState('');
  const currency = iou?.currency || 'GHS';
  const estimated = parseFloat(iou.estimated_amount) || 0;
  const actual = expense ? parseFloat(expense.actual_amount) || 0 : 0;
  const disbursedTotal = (disbursements || []).reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
  const diff = actual - estimated;

  const userConfirmed = Boolean(reconciliation?.confirmed_by_user);
  const cashierConfirmed = Boolean(reconciliation?.confirmed_by_cashier);

  function handleUserConfirm() {
    onRedeem({ notes, targetRole: 'user' });
  }

  function handleCashierConfirm() {
    if (!userConfirmed) {
      toastify.error('The user has to confirm the reconciliation first before the cashier can confirm.');
      return;
    }
    onRedeem({ notes, targetRole: 'cashier' });
  }

  return (
    <Card title="Confirm Reconciliation">
      <div className="p-4 bg-green-50 rounded-lg mb-4 space-y-3">
        <p className="text-sm text-slate-700 font-medium">
          {isOwner
            ? 'This IOU has been reconciled by the cashier. Please review the summary below and click "Confirm Reconciliation" to confirm.'
            : 'This IOU has been reconciled. The requester must confirm first before final cashier confirmation can be submitted.'
          }
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <DetailItem label="Estimated" value={formatCurrency(estimated, currency)} />
          <DetailItem label="Disbursed" value={formatCurrency(disbursedTotal, currency)} />
          <DetailItem label="Actual Spent" value={formatCurrency(actual, currency)} />
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider">Difference</div>
            <div className={`text-sm font-medium mt-0.5 ${diff > 0 ? 'text-red-600' : diff < 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
              {diff > 0 ? '+' : ''}{formatCurrency(diff, currency)}
            </div>
          </div>
        </div>
        {diff > 0 && (
          <div className="text-sm text-amber-700 bg-amber-50 p-2 rounded">
            ⚠️ Overspent by {formatCurrency(diff, currency)}. Please confirm that additional approval has been granted or payment has been made.
          </div>
        )}
        {diff < 0 && (
          <div className="text-sm text-emerald-700 bg-emerald-50 p-2 rounded">
            💰 Underspent by {formatCurrency(Math.abs(diff), currency)}. Please confirm that the excess funds have been returned.
          </div>
        )}
        {diff === 0 && (
          <div className="text-sm text-slate-600 bg-slate-50 p-2 rounded">
            ✓ Exact match - no additional action needed.
          </div>
        )}
      </div>

      {/* Confirmation Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {/* Requester (User) Confirmation Status */}
        <div className={`p-3 rounded-lg border ${userConfirmed ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
          <div className="text-xs font-semibold uppercase tracking-wider mb-1">Requester Confirmation</div>
          {userConfirmed ? (
            <div className="text-sm font-semibold flex items-center gap-1">
              <span>✓ Confirmed by {isOwner ? 'You' : 'User'}</span>
              {reconciliation?.user_confirmed_at && <span className="text-xs font-normal text-emerald-600">({shortDate(reconciliation.user_confirmed_at)})</span>}
            </div>
          ) : (
            <div className="text-sm font-medium text-amber-700">
              {isOwner ? '⏳ Action Required: Please confirm below' : '⏳ Awaiting User Confirmation'}
            </div>
          )}
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm text-slate-700 mb-1">Confirmation Notes (Optional)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder={isOwner ? 'e.g. Confirmed excess funds returned / settled' : 'e.g. Confirmed reconciliation receipt'}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm"
        />
      </div>

      {/* Confirmation Actions */}
      <div className="flex flex-wrap gap-3">
        {isOwner && !userConfirmed && (
          <Button onClick={handleUserConfirm} disabled={loading} className="bg-gradient-to-r from-emerald-600 to-emerald-800">
            {loading ? 'Processing...' : '✓ Confirm Reconciliation (as Requester)'}
          </Button>
        )}

        {isCashier && !cashierConfirmed && (
          <Button onClick={handleCashierConfirm} disabled={loading} className={userConfirmed ? 'bg-gradient-to-r from-blue-600 to-indigo-700' : 'bg-slate-400 hover:bg-slate-500'}>
            {loading ? 'Processing...' : '✓ Confirm Reconciliation (as Cashier)'}
          </Button>
        )}
      </div>
    </Card>
  );
}
