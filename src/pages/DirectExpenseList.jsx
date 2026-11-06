import React, { useEffect, useState, useContext, useMemo } from 'react';
import { listDirectExpenses, getCurrencies, getDepartments } from '../services/iouService';
import Card from '../components/ui/Card';
import { Link } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';

const STATUS_OPTIONS = [
  '', 'DRAFT', 'PENDING_HOD_ASSIGNMENT', 'PENDING',
  'APPROVED_FOR_DISBURSEMENT', 'DISBURSED', 'COMPLETED',
  'RETURNED', 'REJECTED'
];
const STATUS_LABELS = {
  '': 'All Statuses',
  DRAFT: 'Draft',
  PENDING_HOD_ASSIGNMENT: 'Awaiting Approver Assignment',
  PENDING: 'Pending Approval',
  APPROVED_FOR_DISBURSEMENT: 'Approved for Disbursement',
  DISBURSED: 'Disbursed',
  COMPLETED: 'Completed',
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
    DISBURSED: 'bg-blue-100 text-blue-800',
    COMPLETED: 'bg-teal-100 text-teal-800',
    RETURNED: 'bg-yellow-50 text-yellow-800',
    REJECTED: 'bg-red-100 text-red-700'
  };
  const label = STATUS_LABELS[s] || s.replace(/_/g, ' ');
  return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${colors[s] || 'bg-slate-100 text-slate-700'}`}>{label}</span>;
}

function formatCurrency(n, currency = 'GHS') {
  if (n == null) return `${currency} 0.00`;
  const localeMap = { GHS: 'en-GH', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB' };
  try {
    return new Intl.NumberFormat(localeMap[currency] || 'en-US', { style: 'currency', currency }).format(n);
  } catch {
    return `${currency} ${Number(n).toFixed(2)}`;
  }
}

function shortDate(dt) {
  if (!dt) return '-';
  return new Date(dt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function DirectExpenseList() {
  const { user } = useContext(AuthContext);
  const isCashierOrAdmin = user?.is_admin || user?.role === 'cashier';
  const isApprover = user?.is_approver === true;
  const isHod = user?.role === 'hod';
  const canViewAll = isCashierOrAdmin || isApprover || isHod;
  const [viewAll, setViewAll] = useState(canViewAll);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [departments, setDepartments] = useState([]);
  const [currencies, setCurrencies] = useState([]);

  useEffect(() => {
    getCurrencies({ include_inactive: 'true' }).then(res => setCurrencies(res.data?.data || [])).catch(() => { });
    getDepartments().then(res => setDepartments(res.data?.data || [])).catch(() => { });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { fetchItems(); }, 300);
    return () => clearTimeout(timer);
  }, [search, statusFilter, startDate, endDate, viewAll, currencyFilter, deptFilter]);

  async function fetchItems() {
    setLoading(true);
    try {
      const params = { limit: 200 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (currencyFilter) params.currency = currencyFilter;
      if (deptFilter) params.department = deptFilter;
      if (canViewAll && viewAll) params.all = true;
      const res = await listDirectExpenses(params);
      setItems(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const totalCount = items.length;
  const pendingCount = useMemo(() => items.filter(i => ['PENDING', 'PENDING_HOD_ASSIGNMENT', 'APPROVED_FOR_DISBURSEMENT'].includes(i.status)).length, [items]);
  const disbursedCount = useMemo(() => items.filter(i => ['DISBURSED'].includes(i.status)).length, [items]);
  const completedCount = useMemo(() => items.filter(i => ['COMPLETED'].includes(i.status)).length, [items]);

  const pageTitle = useMemo(() => {
    if (canViewAll && viewAll) {
      if (isCashierOrAdmin) return 'Direct Expense Registry';
      if (isHod) return 'Department Direct Expenses';
      return 'Company Direct Expenses';
    }
    return 'My Direct Expenses';
  }, [canViewAll, viewAll, isCashierOrAdmin, isHod]);

  const pageSubtitle = useMemo(() => {
    if (canViewAll && viewAll) {
      if (isCashierOrAdmin) return 'Manage and disburse direct expense reimbursements across all departments';
      if (isHod) return 'Tracking direct expenses submitted across your assigned department(s)';
      return 'Viewing all direct expenses submitted across the company';
    }
    return 'Track your personal direct expense reimbursement requests';
  }, [canViewAll, viewAll, isCashierOrAdmin, isHod]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">{pageTitle}</h1>
            {canViewAll && (
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setViewAll(true)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${viewAll ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  {isHod ? 'Department Requests' : 'All Requests'}
                </button>
                <button
                  type="button"
                  onClick={() => setViewAll(false)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${!viewAll ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  My Submissions
                </button>
              </div>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">{pageSubtitle}</p>
        </div>
        <Link
          to="/direct-expenses/create"
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-700 text-white hover:text-white hover:text-opacity-50 font-semibold text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2 shrink-0"
        >
          + New Direct Expense
        </Link>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 p-5 shadow-lg text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">Total Requests</span>
            <div className="p-1.5 rounded-lg bg-white/10">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
            </div>
          </div>
          <div className="text-3xl font-extrabold">{totalCount}</div>
          <div className="text-xs text-slate-400 mt-1">In current view</div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-5 shadow-lg text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-amber-100 uppercase tracking-wider">Awaiting Action</span>
            <div className="p-1.5 rounded-lg bg-white/15">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            </div>
          </div>
          <div className="text-3xl font-extrabold">{pendingCount}</div>
          <div className="text-xs text-amber-100 mt-1">Approval or disbursement</div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-5 shadow-lg text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-blue-100 uppercase tracking-wider">Disbursed</span>
            <div className="p-1.5 rounded-lg bg-white/15">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
            </div>
          </div>
          <div className="text-3xl font-extrabold">{disbursedCount}</div>
          <div className="text-xs text-blue-100 mt-1">Awaiting confirmation</div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-600 to-cyan-700 p-5 shadow-lg text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-teal-100 uppercase tracking-wider">Completed</span>
            <div className="p-1.5 rounded-lg bg-white/15">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
          </div>
          <div className="text-3xl font-extrabold">{completedCount}</div>
          <div className="text-xs text-teal-100 mt-1">Fully closed</div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[220px] relative">
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Search</label>
            <div className="relative">
              <input
                placeholder="Request #, purpose, requester..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-200 text-sm bg-white"
              />
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" strokeWidth="2" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2" />
              </svg>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Status</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Department</label>
            <select
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
            >
              <option value="">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">From</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">To</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Currency</label>
            <select
              value={currencyFilter}
              onChange={e => setCurrencyFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
            >
              <option value="">All</option>
              {currencies.filter(c => c.is_active).map(c => (
                <option key={c.code} value={c.code}>{c.code}</option>
              ))}
            </select>
          </div>

          {(search || statusFilter || startDate || endDate || currencyFilter || deptFilter) && (
            <button
              onClick={() => { setSearch(''); setStatusFilter(''); setStartDate(''); setEndDate(''); setCurrencyFilter(''); setDeptFilter(''); }}
              className="px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
            >
              Reset
            </button>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="space-y-3 py-4">
            {[0, 1, 2, 3, 4].map(i => <div key={i} className="h-14 bg-slate-50 rounded-xl animate-pulse" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <div className="w-12 h-12 mx-auto mb-3 text-slate-300 flex items-center justify-center">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <p className="text-base font-semibold text-slate-600">No direct expenses found</p>
            <p className="text-sm mt-1">Try adjusting your filters or submit a new direct expense.</p>
            <Link to="/direct-expenses/create" className="text-teal-600 font-semibold hover:underline text-sm mt-3 inline-block">Create new direct expense &rarr;</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-3">Request #</th>
                  <th className="py-3 px-3">Requester</th>
                  <th className="py-3 px-3">Department</th>
                  <th className="py-3 px-3 text-right">Amount</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map(de => (
                  <tr key={de.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-3">
                      <Link to={`/direct-expenses/${de.id}`} className="font-bold text-slate-800 hover:text-teal-600 transition-colors">
                        {de.request_number}
                      </Link>
                      <div className="text-xs text-slate-400 line-clamp-1 max-w-[220px]">{de.purpose}</div>
                    </td>
                    <td className="py-3.5 px-3 font-medium text-slate-700 max-w-[180px] truncate" title={de.requester?.display_name || de.requester?.username || '-'}>
                      {de.requester?.display_name || de.requester?.username || '-'}
                    </td>
                    <td className="py-3.5 px-3 text-slate-600 max-w-[160px] truncate" title={de.department || '-'}>{de.department || '-'}</td>
                    <td className="py-3.5 px-3 text-right font-bold text-slate-800 whitespace-nowrap">{formatCurrency(de.amount, de.currency)}</td>
                    <td className="py-3.5 px-3 text-center"><StatusBadge status={de.status} /></td>
                    <td className="py-3.5 px-3 text-right text-slate-400 text-xs">{shortDate(de.created_at)}</td>
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

