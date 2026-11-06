import React, { useEffect, useState, useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getDirectExpense, submitDirectExpense, assignDEApprovers,
  updateDirectExpense, confirmDEApproval,
  disburseDERequest, confirmDEDisbursement, completeDirectExpense,
  getDEDisbursements, getUsers, decideApproval as decideApprovalApi, listApprovers as listApproversApi,
  cashierRejectDE as cashierRejectDEApi, cashierReturnDE as cashierReturnDEApi
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
    COMPLETED: 'bg-teal-100 text-teal-800',
    RETURNED: 'bg-yellow-50 text-yellow-800',
    REJECTED: 'bg-red-100 text-red-700'
  };
  const label = s === 'PENDING_HOD_ASSIGNMENT' ? 'Awaiting Approver Assignment' : s === 'DISBURSEMENT_CONFIRMED' ? 'Funds Confirmed' : s.replace(/_/g, ' ');
  return <span className={`px-3 py-1 rounded-full text-xs font-semibold ${colors[s] || 'bg-slate-100 text-slate-700'}`}>{label}</span>;
}

function formatCurrency(n, currency = 'GHS') {
  if (n == null) return `${currency} 0.00`;
  const localeMap = { GHS: 'en-GH', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB' };
  try { return new Intl.NumberFormat(localeMap[currency] || 'en-US', { style: 'currency', currency }).format(n); }
  catch { return `${currency} ${Number(n).toFixed(2)}`; }
}

function shortDate(dt) {
  if (!dt) return '-';
  return new Date(dt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* ── Status Timeline (simplified for Direct Expense) ── */
const TIMELINE_STEPS = ['DRAFT', 'PENDING_HOD_ASSIGNMENT', 'PENDING', 'APPROVED_FOR_DISBURSEMENT', 'DISBURSED', 'DISBURSEMENT_CONFIRMED', 'COMPLETED'];
const STEP_LABELS = {
  DRAFT: 'Draft', PENDING_HOD_ASSIGNMENT: 'Assign Approvers', PENDING: 'Pending Approval',
  APPROVED_FOR_DISBURSEMENT: 'Approved', DISBURSED: 'Disbursed', DISBURSEMENT_CONFIRMED: 'Funds Confirmed', COMPLETED: 'Completed'
};

function StatusTimeline({ currentStatus }) {
  const s = (currentStatus || '').toUpperCase();
  const isTerminal = ['REJECTED', 'RETURNED'].includes(s);
  const currentIdx = TIMELINE_STEPS.indexOf(s);
  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2">
      {TIMELINE_STEPS.map((step, idx) => {
        const isActive = idx === currentIdx;
        const isDone = currentIdx > idx;
        return (
          <React.Fragment key={step}>
            {idx > 0 && <div className={`h-0.5 w-6 flex-shrink-0 ${isDone ? 'bg-teal-400' : 'bg-slate-200'}`} />}
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium flex-shrink-0 transition
              ${isActive ? 'bg-teal-500 text-white shadow-md' : isDone ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-400'}`}>
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

function DetailItem({ label, value }) {
  return (
    <div>
      <div className="text-xs text-slate-500 uppercase tracking-wider">{label}</div>
      <div className="text-sm font-medium text-slate-800 mt-0.5">{value}</div>
    </div>
  );
}

/* ── Main DirectExpenseDetail ── */
export default function DirectExpenseDetail() {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const [de, setDe] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [disbursements, setDisbursements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editPurpose, setEditPurpose] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCurrency, setEditCurrency] = useState('GHS');
  const [approverNames, setApproverNames] = useState({});
  const [deIfsVoucher, setDeIfsVoucher] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await getDirectExpense(id);
      setDe(res.data.directExpense);
      if (res.data.directExpense?.ifs_voucher_number) {
        setDeIfsVoucher(res.data.directExpense.ifs_voucher_number);
      }
      setAttachments(res.data.attachments || []);
      setApprovals(res.data.approvals || []);

      const disbRes = await getDEDisbursements(id).catch(() => ({ data: { data: [] } }));
      setDisbursements(disbRes.data.data || []);

      // Resolve approver names
      const approverIds = (res.data.approvals || []).map(a => a.approver_id).filter(Boolean);
      const uniqueIds = [...new Set(approverIds)];
      const names = { ...approverNames };
      for (const uid of uniqueIds) {
        if (!names[uid]) {
          try { const uRes = await api.get(`/users/${uid}`); names[uid] = uRes.data.user?.display_name || uRes.data.user?.username || uid; }
          catch { names[uid] = uid; }
        }
      }
      setApproverNames(names);
    } catch (err) {
      console.error(err);
      toastify.error(err?.response?.data?.message || 'Failed to load Direct Expense');
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [id]);

  async function handleAction(action, data = {}) {
    setActionLoading(true);
    try {
      let response;
      if (action === 'submit') response = await submitDirectExpense(id);
      else if (action === 'disburse') response = await disburseDERequest(id, data);
      else if (action === 'confirmDisbursement') response = await confirmDEDisbursement(id, data);
      else if (action === 'complete') response = await completeDirectExpense(id, data);
      toastify.success(response?.data?.message || `${action} completed successfully!`);
      await load();
    } catch (err) {
      toastify.error(err?.response?.data?.message || `${action} failed. Please try again.`);
    } finally { setActionLoading(false); }
  }

  if (loading) return (
    <div className="space-y-4">
      {[0, 1, 2].map(i => <div key={i} className="h-32 bg-white/80 rounded-xl animate-pulse" />)}
    </div>
  );

  if (!de) return <Card>Direct Expense not found</Card>;

  const isOwner = user?.id === de.requester_id;
  const isCashier = user?.is_admin || user?.role === 'cashier';
  const status = (de.status || '').toUpperCase();
  const deApprovals = approvals.filter(a => a.approval_type === 'direct_expense');

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link to="/direct-expenses" className="text-sm text-slate-500 hover:text-slate-700">← Back to Direct Expenses</Link>
          <h2 className="text-2xl font-bold text-slate-800 mt-1">{de.request_number}</h2>
        </div>
        <StatusBadge status={de.status} />
      </div>

      {/* Returned Banner */}
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
            <p className="mt-2">Please update the details below and re-submit for approval.</p>
          </div>
        );
      })()}

      {/* Rejected Banner */}
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
        <StatusTimeline currentStatus={de.status} />
      </Card>

      {/* Details */}
      <Card title="Direct Expense Details" action={
        (isOwner && ['DRAFT', 'RETURNED'].includes(status) && !isEditing) && (
          <button onClick={() => {
            setIsEditing(true);
            setEditPurpose(de.purpose || '');
            setEditAmount(de.amount || '');
            setEditCurrency(de.currency || 'GHS');
          }} className="text-sm font-semibold text-teal-600 hover:text-teal-800 transition">Edit Details</button>
        )
      }>
        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Purpose <span className="text-red-500">*</span></label>
              <textarea value={editPurpose} onChange={e => setEditPurpose(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-200 text-sm font-medium" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Amount ({editCurrency}) <span className="text-red-500">*</span></label>
              <input type="number" step="0.01" value={editAmount} onChange={e => setEditAmount(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-200 text-sm font-medium" />
            </div>
            <div className="flex gap-2">
              <Button onClick={async () => {
                if (!editPurpose.trim()) { toastify.error('Purpose is required'); return; }
                if (!editAmount || isNaN(editAmount) || Number(editAmount) <= 0) { toastify.error('Enter a valid amount'); return; }
                setActionLoading(true);
                try {
                  const res = await updateDirectExpense(id, { purpose: editPurpose, amount: Number(editAmount), currency: editCurrency, attachments });
                  setDe(res.data.directExpense);
                  setAttachments(res.data.attachments || []);
                  setIsEditing(false);
                  toastify.success('Details updated!');
                } catch (err) { toastify.error(err?.response?.data?.message || 'Failed to update'); }
                finally { setActionLoading(false); }
              }} disabled={actionLoading}>{actionLoading ? 'Saving...' : 'Save Changes'}</Button>
              <Button variant="secondary" onClick={() => setIsEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <DetailItem label="Purpose" value={de.purpose || '-'} />
            <DetailItem label="Amount" value={formatCurrency(de.amount, de.currency)} />
            <DetailItem label="Currency" value={de.currency || 'GHS'} />
            <DetailItem label="Department" value={de.department || '-'} />
            <DetailItem label="Created" value={shortDate(de.created_at)} />
            <DetailItem label="Submitted" value={shortDate(de.submitted_at)} />
            {de.ifs_voucher_number && (
              <DetailItem
                label="IFS Voucher #"
                value={
                  <a
                    href="https://ifsprod.apmterminals.com/client/runtime/Ifs.Fnd.Explorer.application"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline inline-flex items-center gap-1 font-semibold"
                  >
                    {de.ifs_voucher_number}
                    <svg className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                }
              />
            )}
          </div>
        )}
      </Card>

      {/* Approval Chain */}
      <Card title="Approval Chain">
        {deApprovals.length === 0 ? (
          <p className="text-sm text-slate-500">{['PENDING', 'PENDING_HOD_ASSIGNMENT'].includes(status) ? 'Awaiting approver assignment by Cashier' : 'No approvers assigned yet'}</p>
        ) : (
          <div className="space-y-3">
            {deApprovals.map(app => {
              const isMyApproval = user?.id === app.approver_id && app.decision === 'PENDING';
              const isMyTurn = isMyApproval && !deApprovals.some(a => a.step_order < app.step_order && a.decision === 'PENDING');
              const canAct = isMyTurn && !isOwner;
              return (
                <div key={app.id} className={`p-3 rounded-lg border ${canAct ? 'bg-teal-50 border-teal-200 ring-2 ring-teal-300/50' : 'bg-slate-50 border-slate-100'}`}>
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
                  {canAct && <InlineApprovalActions approvalId={app.id} onDecided={load} />}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Attachments */}
      <Card title="Receipts / Evidence">
        {(isOwner && ['DRAFT', 'RETURNED'].includes(status)) && (
          <div className="mb-3">
            <FileUploader onUploaded={(a) => setAttachments(s => [...s, a])} />
          </div>
        )}
        {attachments.length === 0 ? (
          <p className="text-sm text-red-500">No attachments - receipts are required for Direct Expense</p>
        ) : (
          <div className="space-y-2">
            {attachments.map(a => (
              <div key={a.id} className="flex items-center justify-between px-3 py-2 bg-teal-50 rounded-lg border border-teal-100">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                  <span className="text-sm">{a.file_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <a href="#" onClick={async (e) => { e.preventDefault(); try { const r = await api.get(`/uploads/${a.id}/download`); window.open(r.data.url); } catch { toastify.error('Failed to download'); } }} className="text-teal-600 text-sm hover:underline">Download</a>
                  {isOwner && ['DRAFT', 'RETURNED'].includes(status) && (
                    <button onClick={async () => { try { await api.delete(`/uploads/${a.id}`); setAttachments(s => s.filter(x => x.id !== a.id)); toastify.success('Removed'); } catch { toastify.error('Failed to delete'); } }} className="text-red-400 text-sm hover:text-red-600">Remove</button>
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
              <DetailItem label="Amount" value={formatCurrency(d.amount, de.currency)} />
              <DetailItem label="Method" value={d.payment_method || '-'} />
              <DetailItem label="Reference" value={d.payment_reference || '-'} />
              <DetailItem label="Disbursed" value={shortDate(d.disbursed_at)} />
              {d.cashier && <DetailItem label="Cashier" value={d.cashier.display_name || d.cashier.username} />}
              <DetailItem label="Confirmed" value={d.confirmed_by_user ? `✓ ${shortDate(d.confirmed_at)}` : 'Not yet'} />
            </div>
          ))}
        </Card>
      )}

      {/* Step 1: Requester confirms receipt of funds */}
      {isOwner && status === 'DISBURSED' && (
        <Card title="Confirm Receipt of Funds">
          <p className="text-sm text-slate-600 mb-3">Please confirm that you have received the disbursed funds.</p>
          <Button onClick={() => handleAction('confirmDisbursement')} disabled={actionLoading}>
            {actionLoading ? 'Confirming...' : '✓ Confirm - I received the funds'}
          </Button>
        </Card>
      )}

      {/* Cashier sees waiting banner while status is DISBURSED */}
      {isCashier && !isOwner && status === 'DISBURSED' && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800 flex items-center gap-3">
          <span className="text-xl">⏳</span>
          <div>
            <span className="font-semibold">Funds Disbursed:</span> Awaiting requester to confirm receipt of funds before this request can be completed.
          </div>
        </div>
      )}

      {/* Step 2: Cashier marks as COMPLETED with mandatory IFS Voucher */}
      {isCashier && status === 'DISBURSEMENT_CONFIRMED' && (
        <Card title="Complete Direct Expense">
          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 mb-4">
            <p className="text-sm text-emerald-800 font-medium">✓ Requester has confirmed receipt of funds.</p>
            <p className="text-sm text-emerald-700 mt-0.5">Please verify or enter the IFS Voucher Number to finalize and mark this Direct Expense as Completed.</p>
          </div>
          <div className="max-w-md mb-4">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              IFS Voucher Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. 2026/V/12345"
              value={deIfsVoucher}
              onChange={e => setDeIfsVoucher(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200 font-mono"
            />
          </div>
          <Button
            onClick={() => {
              if (!deIfsVoucher || !deIfsVoucher.trim()) {
                toastify.error('IFS Voucher Number is required to complete the Direct Expense');
                return;
              }
              handleAction('complete', { ifs_voucher_number: deIfsVoucher.trim() });
            }}
            disabled={actionLoading || !deIfsVoucher.trim()}
          >
            {actionLoading ? 'Completing...' : '✓ Mark as Completed'}
          </Button>
        </Card>
      )}

      {/* Requester sees waiting banner while status is DISBURSEMENT_CONFIRMED */}
      {isOwner && !isCashier && status === 'DISBURSEMENT_CONFIRMED' && (
        <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl text-sm text-teal-800 flex items-center gap-3">
          <span className="text-xl">✓</span>
          <div>
            <span className="font-semibold">Receipt Confirmed:</span> You have confirmed receipt of funds. Awaiting cashier to finalize and mark this Direct Expense as completed.
          </div>
        </div>
      )}

      {/* Submit for Approval */}
      {isOwner && ['DRAFT', 'RETURNED'].includes(status) && (
        <Card title="Submit for Approval">
          <p className="text-sm text-slate-600 mb-3">Submit this Direct Expense to start the approval workflow. The Cashier will assign your Head of Department and the approval chain.</p>
          <Button onClick={() => handleAction('submit')} disabled={actionLoading || attachments.length === 0}>
            {actionLoading ? 'Submitting...' : attachments.length === 0 ? 'Add Receipts First' : 'Submit for Approval'}
          </Button>
        </Card>
      )}

      {/* Cashier: Assign Approvers */}
      {isCashier && ['PENDING_HOD_ASSIGNMENT', 'PENDING'].includes(status) && (
        <AssignApproversPanel
          deId={id}
          requesterId={de.requester_id}
          existingApprovals={deApprovals}
          approverNames={approverNames}
          onAssigned={load}
          deStatus={status}
          onStatusChanged={load}
        />
      )}

      {/* Cashier: Confirm Approval */}
      {isCashier && status === 'PENDING' && deApprovals.length > 0 && deApprovals.every(a => a.decision === 'APPROVED') && (
        <Card title="Confirm Approval">
          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 mb-3">
            <p className="text-sm text-emerald-800 font-medium">✓ All {deApprovals.length} approver(s) have approved this Direct Expense.</p>
            <p className="text-sm text-emerald-700 mt-1">Click below to finalize and move to disbursement.</p>
          </div>
          <Button onClick={async () => {
            setActionLoading(true);
            try { const res = await confirmDEApproval(id); toastify.success(res?.data?.message || 'Approval confirmed!'); await load(); }
            catch (err) { toastify.error(err?.response?.data?.message || 'Failed to confirm'); }
            finally { setActionLoading(false); }
          }} disabled={actionLoading}>
            {actionLoading ? 'Confirming...' : '✓ Confirm Approval - Proceed to Disbursement'}
          </Button>
        </Card>
      )}

      {/* Cashier: Disburse */}
      {isCashier && status === 'APPROVED_FOR_DISBURSEMENT' && (
        <DisbursePanel amount={de.amount} currency={de.currency} onDisburse={(data) => handleAction('disburse', data)} loading={actionLoading} />
      )}
    </div>
  );
}

/* ── Inline Approval Actions ── */
function InlineApprovalActions({ approvalId, onDecided }) {
  const [deciding, setDeciding] = useState(false);
  const [showModal, setShowModal] = useState(null);
  const [comments, setComments] = useState('');

  async function handleDecision(decision) {
    setDeciding(true);
    try {
      await decideApprovalApi(approvalId, { decision, comments });
      toastify.success(`Decision recorded: ${decision}`);
      setShowModal(null);
      setComments('');
      onDecided?.();
    } catch (err) { toastify.error(err?.response?.data?.message || 'Failed'); }
    finally { setDeciding(false); }
  }

  return (
    <>
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-teal-200">
        <span className="text-xs text-teal-600 font-medium mr-2">Your turn:</span>
        <button onClick={() => setShowModal('APPROVED')} disabled={deciding} className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-700 text-white font-semibold text-xs shadow hover:shadow-md transition">Approve</button>
        <button onClick={() => setShowModal('RETURNED')} disabled={deciding} className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-yellow-400 to-yellow-600 text-white font-semibold text-xs shadow hover:shadow-md transition">Return</button>
        <button onClick={() => setShowModal('REJECTED')} disabled={deciding} className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-red-500 to-red-700 text-white font-semibold text-xs shadow hover:shadow-md transition">Reject</button>
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => !deciding && setShowModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800 mb-3">Confirm {showModal}</h3>
            <div className="mb-4">
              <label className="block text-sm text-slate-700 mb-1">Comments {showModal !== 'APPROVED' ? <span className="text-red-500">*</span> : '(optional)'}</label>
              <textarea value={comments} onChange={e => setComments(e.target.value)} rows={3} placeholder="Add comments..." className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-200" autoFocus />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowModal(null)} disabled={deciding} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm">Cancel</button>
              <button
                onClick={() => showModal !== 'APPROVED' && !comments.trim() ? toastify.error('Comments are required') : handleDecision(showModal)}
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

/* ── Assign Approvers Panel ── */
function AssignApproversPanel({ deId, requesterId, existingApprovals, approverNames, onAssigned, deStatus, onStatusChanged }) {
  const occupied = (existingApprovals || []).filter(a => a.approval_type === 'direct_expense');
  const startStep = occupied.length + 1;
  const initialRows = occupied.length === 0
    ? [
        { approver_id: '', step_order: 1, display_name: '' },
        { approver_id: '', step_order: 2, display_name: '' }
      ]
    : [{ approver_id: '', step_order: startStep, display_name: '' }];

  const [rows, setRows] = useState(initialRows);
  const [hodUsers, setHodUsers] = useState([]);
  const [managedApprovers, setManagedApprovers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [actionComments, setActionComments] = useState('');
  const [actioning, setActioning] = useState(false);

  useEffect(() => {
    setRows(
      occupied.length === 0
        ? [
            { approver_id: '', step_order: 1, display_name: '' },
            { approver_id: '', step_order: 2, display_name: '' }
          ]
        : [{ approver_id: '', step_order: startStep, display_name: '' }]
    );
  }, [startStep, occupied.length]);

  useEffect(() => {
    async function loadEligible() {
      setLoadingUsers(true);
      try {
        const [hodRes, appRes] = await Promise.all([
          getUsers({ role: 'hod', is_active: true, limit: 200, local_only: true }),
          listApproversApi()
        ]);
        setHodUsers(hodRes.data.data || []);
        setManagedApprovers(appRes.data.data || []);
      } catch (err) { console.error('Failed to load approvers', err); }
      finally { setLoadingUsers(false); }
    }
    loadEligible();
  }, []);

  function removeRow(idx) {
    const remaining = rows.filter((_, i) => i !== idx);
    const recalc = remaining.map((r, i) => ({ ...r, step_order: startStep + i }));
    setRows(recalc);
  }

  function addRow() { setRows(s => [...s, { approver_id: '', step_order: startStep + s.length, display_name: '' }]); }

  async function handleAssign() {
    const valid = rows.filter(r => r.approver_id);
    const allApprovers = [
      ...occupied.map(a => ({ approver_id: a.approver_id, step_order: a.step_order })),
      ...valid.map(r => ({ approver_id: r.approver_id, step_order: r.step_order }))
    ];
    if (allApprovers.length === 0) { toastify.error('Please select at least one approver'); return; }
    if (allApprovers.length < 2) {
      toastify.error('Direct Expense requests require a minimum of 2 approvers (1 Head of Department + at least 1 authorizer from the Approvers list)');
      return;
    }
    const ids = allApprovers.map(a => a.approver_id);
    if (new Set(ids).size !== ids.length) { toastify.error('Each approver can only be assigned once'); return; }
    setSubmitting(true);
    try {
      await assignDEApprovers(deId, allApprovers);
      toastify.success('Approvers assigned successfully!');
      onAssigned?.();
    } catch (err) { toastify.error(err?.response?.data?.message || 'Failed to assign approvers'); }
    finally { setSubmitting(false); }
  }

  async function handleCashierAction(type) {
    if (!actionComments.trim()) { toastify.error('A reason/comment is required'); return; }
    setActioning(true);
    try {
      if (type === 'reject') { await cashierRejectDEApi(deId, { comments: actionComments }); toastify.success('Rejected.'); }
      else { await cashierReturnDEApi(deId, { comments: actionComments }); toastify.success('Returned.'); }
      setShowRejectModal(false); setShowReturnModal(false); setActionComments('');
      onStatusChanged?.();
    } catch (err) { toastify.error(err?.response?.data?.message || 'Action failed'); }
    finally { setActioning(false); }
  }

  const eligibleForStep = (stepIdx) => {
    const isStep1 = (stepIdx === 0 && occupied.length === 0);
    const selectedInOtherRows = new Set(
      rows
        .filter((_, i) => i !== stepIdx)
        .map(r => r.approver_id)
        .concat(occupied.map(a => a.approver_id))
        .filter(Boolean)
    );

    if (isStep1) {
      // Step 1: Strictly HODs only
      return hodUsers.filter(u => u.id !== requesterId && !selectedInOtherRows.has(u.id));
    }
    // Step 2+: Strictly managed Approvers list only (NOT HODs unless in Approvers list)
    return managedApprovers.filter(u => u.id !== requesterId && !selectedInOtherRows.has(u.id));
  };

  const minRowsAllowed = occupied.length === 0 ? 2 : 1;

  return (
    <Card title="Assign Approval Chain">
      <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-sm text-teal-800 mb-4">
        <strong>Approval Chain Rules:</strong> The first approver must be your Head of Department (HOD). Subsequent approvers (step 2 onwards) must be selected from the managed Approvers list. <strong>Minimum 2 approvers required in total (1 HOD + at least 1 authorizer from Approvers list).</strong>
      </div>

      {/* Already assigned */}
      {occupied.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Already Assigned</p>
          {occupied.map(a => (
            <div key={a.id} className="flex items-center gap-2 p-2 bg-slate-100 rounded-lg text-sm">
              <span className="w-7 h-7 rounded-full bg-emerald-200 text-emerald-700 flex items-center justify-center text-xs font-bold">{a.step_order}</span>
              <span className="font-medium">{approverNames[a.approver_id] || a.approver_id}</span>
              <span className={`ml-auto text-xs font-semibold ${a.decision === 'APPROVED' ? 'text-emerald-600' : 'text-amber-500'}`}>{a.decision}</span>
            </div>
          ))}
        </div>
      )}

      {loadingUsers ? <p className="text-sm text-slate-500">Loading eligible approvers...</p> : (
        <>
          {rows.map((row, idx) => (
            <div key={idx} className="flex items-center gap-3 mb-3">
              <span className="w-7 h-7 rounded-full bg-teal-200 text-teal-700 flex items-center justify-center text-xs font-bold shrink-0">{row.step_order}</span>
              <select
                value={row.approver_id}
                onChange={e => {
                  const sel = e.target.value;
                  const pool = [...managedApprovers, ...hodUsers];
                  const nm = pool.find(u => u.id === sel);
                  setRows(s => s.map((r, i) => i === idx ? { ...r, approver_id: sel, display_name: nm?.display_name || nm?.username || '' } : r));
                }}
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-teal-200"
              >
                <option value="">{idx === 0 && occupied.length === 0 ? '-- Select Head of Department (HOD) --' : '-- Select Approver (from Approvers List) --'}</option>
                {eligibleForStep(idx).map(u => (
                  <option key={u.id} value={u.id}>{u.display_name || u.username} ({u.role}{u.department ? ` - ${u.department}` : ''})</option>
                ))}
              </select>
              {rows.length > minRowsAllowed && <button onClick={() => removeRow(idx)} className="text-red-400 hover:text-red-600 text-lg" title="Remove step">✕</button>}
            </div>
          ))}

          <div className="flex gap-3 mt-4">
            <button onClick={addRow} className="px-3 py-1.5 rounded-lg border-2 border-dashed border-teal-300 text-teal-600 text-xs font-semibold hover:bg-teal-50 transition">+ Add Approver</button>
            <Button onClick={handleAssign} disabled={submitting}>{submitting ? 'Assigning...' : 'Assign Approvers'}</Button>
          </div>
        </>
      )}

      {/* Cashier Reject/Return */}
      {deStatus === 'PENDING_HOD_ASSIGNMENT' && (
        <div className="mt-5 pt-4 border-t border-slate-200 flex gap-3">
          <button onClick={() => { setShowReturnModal(true); setActionComments(''); }} className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 text-white font-semibold text-xs shadow-md hover:shadow-lg">Return for Edits</button>
          <button onClick={() => { setShowRejectModal(true); setActionComments(''); }} className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-500 to-red-700 text-white font-semibold text-xs shadow-md hover:shadow-lg">Reject</button>
        </div>
      )}

      {/* Return Modal */}
      {showReturnModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => !actioning && setShowReturnModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800 mb-3">Return for Edits</h3>
            <textarea value={actionComments} onChange={e => setActionComments(e.target.value)} rows={3} placeholder="Reason for returning..." className="w-full px-3 py-2 rounded-lg border border-slate-200 mb-4 focus:outline-none focus:ring-2 focus:ring-amber-200" autoFocus />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowReturnModal(false)} disabled={actioning} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm">Cancel</button>
              <button onClick={() => handleCashierAction('return')} disabled={actioning} className="px-5 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-600 text-white font-semibold text-sm shadow-md">{actioning ? 'Returning...' : 'Confirm Return'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => !actioning && setShowRejectModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800 mb-3">Reject Direct Expense</h3>
            <textarea value={actionComments} onChange={e => setActionComments(e.target.value)} rows={3} placeholder="Reason for rejection..." className="w-full px-3 py-2 rounded-lg border border-slate-200 mb-4 focus:outline-none focus:ring-2 focus:ring-red-200" autoFocus />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowRejectModal(false)} disabled={actioning} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm">Cancel</button>
              <button onClick={() => handleCashierAction('reject')} disabled={actioning} className="px-5 py-2 rounded-lg bg-gradient-to-r from-red-500 to-red-700 text-white font-semibold text-sm shadow-md">{actioning ? 'Rejecting...' : 'Confirm Reject'}</button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ── Disburse Panel ── */
function DisbursePanel({ amount: deAmount, currency, onDisburse, loading }) {
  const [amount, setAmount] = useState(deAmount || '');
  const [method, setMethod] = useState('');
  const [reference, setReference] = useState('');
  const [ifsVoucher, setIfsVoucher] = useState('');
  const [notes, setNotes] = useState('');

  return (
    <Card title="Disburse Funds">
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Amount ({currency}) <span className="text-red-500">*</span></label>
            <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-teal-200" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Payment Method</label>
            <select value={method} onChange={e => setMethod(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white">
              <option value="">Select...</option>
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="mobile_money">Mobile Money</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Payment Reference</label>
            <input value={reference} onChange={e => setReference(e.target.value)} placeholder="Transaction ref, cheque number, etc." className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">IFS Voucher Number <span className="text-red-500">*</span></label>
            <input value={ifsVoucher} onChange={e => setIfsVoucher(e.target.value)} placeholder="e.g. 2026/V/12345" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Notes..." className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
        </div>
        <Button onClick={() => {
          if (!amount || isNaN(amount) || Number(amount) <= 0) { toastify.error('Enter a valid amount'); return; }
          if (!ifsVoucher || !ifsVoucher.trim()) { toastify.error('IFS Voucher Number is required to disburse funds'); return; }
          onDisburse({
            amount: Number(amount),
            payment_method: method || null,
            payment_reference: reference || null,
            ifs_voucher_number: ifsVoucher.trim(),
            notes: notes || null
          });
        }} disabled={loading}>
          {loading ? 'Disbursing...' : `Disburse ${formatCurrency(amount, currency)}`}
        </Button>
      </div>
    </Card>
  );
}

