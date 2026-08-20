import React, { useEffect, useState, useContext } from 'react';
import { listIOUs } from '../services/iouService';
import Card from '../components/ui/Card';
import { Link } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';

const STATUS_OPTIONS = [
  '', 'DRAFT', 'PENDING_HOD_ASSIGNMENT', 'PENDING',
  'APPROVED_FOR_DISBURSEMENT', 'DISBURSED', 'DISBURSEMENT_CONFIRMED',
  'EXPENSE_PENDING_APPROVAL', 'EXPENSE_SUBMITTED', 'EXPENSE_RETURNED',
  'RECONCILED', 'REDEEMED', 'RETURNED', 'REJECTED'
];
const STATUS_LABELS = {
  '': 'All Statuses',
  DRAFT: 'Draft',
  PENDING_HOD_ASSIGNMENT: 'Awaiting Approver Assignment',
  PENDING: 'Pending Approval',
  APPROVED_FOR_DISBURSEMENT: 'Approved for Disbursement',
  DISBURSED: 'Disbursed',
  DISBURSEMENT_CONFIRMED: 'Disbursement Confirmed',
  EXPENSE_PENDING_APPROVAL: 'Expense Pending Approval',
  EXPENSE_SUBMITTED: 'Expense Submitted',
  EXPENSE_RETURNED: 'Expense Returned',
  RECONCILED: 'Reconciled',
  REDEEMED: 'Redeemed',
  RETURNED: 'Returned',
  REJECTED: 'Rejected'
};

function StatusBadge({ status }) {
  const s = (status || '').toUpperCase();
  const colors = {
    DRAFT: 'bg-slate-100 text-slate-700',
    PENDING_HOD_ASSIGNMENT: 'bg-indigo-100 text-indigo-800',
    PENDING: 'bg-amber-100 text-amber-800',
    APPROVED_FOR_DISBURSEMENT: 'bg-emerald-100 text-emerald-800',
    APPROVED: 'bg-emerald-100 text-emerald-800',
    DISBURSED: 'bg-blue-100 text-blue-800',
    DISBURSEMENT_CONFIRMED: 'bg-blue-200 text-blue-900',
    EXPENSE_PENDING_APPROVAL: 'bg-orange-100 text-orange-800',
    EXPENSE_SUBMITTED: 'bg-purple-100 text-purple-800',
    EXPENSE_RETURNED: 'bg-yellow-100 text-yellow-800',
    RECONCILED: 'bg-teal-100 text-teal-800',
    REDEEMED: 'bg-green-100 text-green-800',
    RETURNED: 'bg-yellow-50 text-yellow-800',
    REJECTED: 'bg-red-100 text-red-700',
    CANCELLED: 'bg-gray-100 text-gray-600'
  };
  const label = STATUS_LABELS[s] || s.replace(/_/g, ' ');
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[s] || 'bg-slate-100 text-slate-700'}`}>{label}</span>;
}

function formatCurrency(n, currency = 'GHS') {
  if (n == null) return `${currency} 0.00`;
  const localeMap = { GHS: 'en-GH', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB' };
  return new Intl.NumberFormat(localeMap[currency] || 'en-US', { style: 'currency', currency }).format(n);
}

function shortDate(dt) {
  if (!dt) return '-';
  return new Date(dt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function IOUList() {
  const { user } = useContext(AuthContext);
  const [ious, setIous] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [viewAll, setViewAll] = useState(false);

  const canViewAll = user?.is_admin || user?.role === 'cashier';

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchIOUs();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, statusFilter, startDate, endDate, viewAll]);

  async function fetchIOUs() {
    setLoading(true);
    try {
      const params = { limit: 200 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (canViewAll && viewAll) params.all = true;
      const res = await listIOUs(params);
      setIous(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-2xl font-bold text-slate-800">{viewAll ? 'All Requests' : 'My Requests'}</h2>
        <Link to="/ious/create" className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-700 text-white font-semibold shadow-md hover:shadow-lg transition">
          + Request IOU
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-slate-500 mb-1 block">Search</label>
            <input
              placeholder="Request #, purpose, requester, IFS voucher, amount..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm">
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">From</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">To</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm" />
          </div>
          {canViewAll && (
            <label className="flex items-center gap-2 text-sm cursor-pointer py-2">
              <input type="checkbox" checked={viewAll} onChange={e => setViewAll(e.target.checked)} className="rounded" />
              View all
            </label>
          )}
          <button onClick={() => { setSearch(''); setStatusFilter(''); setStartDate(''); setEndDate(''); }} className="px-3 py-2 text-sm text-slate-500 hover:text-slate-800">
            Reset
          </button>
        </div>
      </Card>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map(i => <div key={i} className="h-12 bg-slate-50 rounded animate-pulse" />)}
          </div>
        ) : ious.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <div className="text-4xl mb-2">📋</div>
            <p>No IOUs found</p>
            <Link to="/ious/create" className="text-emerald-600 hover:underline text-sm mt-2 inline-block">Create your first IOU →</Link>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-slate-500 text-xs uppercase">
                  <th className="text-left py-3 px-2">Request #</th>
                  <th className="text-left py-3 px-2">Requester</th>
                  <th className="text-left py-3 px-2">Department</th>
                  <th className="text-right py-3 px-2">Amount</th>
                  <th className="text-center py-3 px-2">Status</th>
                  <th className="text-left py-3 px-2">IFS Voucher</th>
                  <th className="text-right py-3 px-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {ious.map(iou => (
                  <tr key={iou.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-2">
                      <Link to={`/ious/${iou.id}`} className="font-medium text-slate-800 hover:text-emerald-700 hover:underline">
                        {iou.request_number}
                      </Link>
                      <div className="text-xs text-slate-500 line-clamp-1 max-w-[200px]">{iou.purpose}</div>
                    </td>
                    <td className="py-3 px-2 text-slate-600">
                      {iou.requester?.display_name || iou.requester?.username || '-'}
                    </td>
                    <td className="py-3 px-2 text-slate-600">{iou.department || '-'}</td>
                    <td className="py-3 px-2 text-right font-medium">{formatCurrency(iou.estimated_amount, iou.currency)}</td>
                    <td className="py-3 px-2 text-center"><StatusBadge status={iou.status} /></td>
                    <td className="py-3 px-2">
                      {iou.ifs_voucher_number ? (
                        <a
                          href={'https://ifsprod.apmterminals.com/client/runtime/Ifs.Fnd.Explorer.application'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline inline-flex items-center gap-1 font-semibold"
                          onClick={e => e.stopPropagation()}
                        >
                          {iou.ifs_voucher_number}
                        </a>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-right text-slate-500 text-xs">{shortDate(iou.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
