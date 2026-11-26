import React, { useEffect, useState, useContext, useMemo, useRef } from 'react';
import { listIOUs, getCurrencies, getDepartments } from '../services/iouService';
import Card from '../components/ui/Card';
import TallyBreakdownBar from '../components/ui/TallyBreakdownBar';
import IfsVoucherDisplay from '../components/ui/IfsVoucherDisplay';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { formatCurrency } from '../utils/currency';
import { matchesIouStatus } from '../utils/statusFilters';

const STATUS_OPTIONS = [
  '', 'PENDING_GROUP', 'APPROVED_READY_GROUP', 'AWAITING_ACTION_GROUP', 'ACTIVE_DISBURSED_GROUP', 'SETTLED_GROUP',
  'IN_PROGRESS_GROUP', 'DRAFT_RETURNED_GROUP', 'REJECTED_GROUP', 'APPROVED_GROUP',
  'DRAFT', 'PENDING_HOD_ASSIGNMENT', 'PENDING',
  'APPROVED_FOR_DISBURSEMENT', 'DISBURSED', 'DISBURSEMENT_CONFIRMED',
  'EXPENSE_PENDING_APPROVAL', 'EXPENSE_SUBMITTED', 'EXPENSE_RETURNED',
  'RECONCILED', 'REDEEMED', 'RETURNED', 'REJECTED'
];
const STATUS_LABELS = {
  '': 'All Statuses',
  PENDING_GROUP: 'All Pending (Assignment & Approval)',
  APPROVED_READY_GROUP: 'Approved (Ready to Disburse)',
  AWAITING_ACTION_GROUP: 'Awaiting Action (Pending & Ready)',
  ACTIVE_DISBURSED_GROUP: 'Disbursed / Active',
  SETTLED_GROUP: 'Settled & Redeemed',
  IN_PROGRESS_GROUP: 'Disbursed & In Progress',
  DRAFT_RETURNED_GROUP: 'Draft & Returned',
  REJECTED_GROUP: 'Rejected & Cancelled',
  APPROVED_GROUP: 'All Approved Requests',
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
  return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${colors[s] || 'bg-slate-100 text-slate-700'}`}>{label}</span>;
}

function shortDate(dt) {
  if (!dt) return '-';
  return new Date(dt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function IOUList() {
  const { user } = useContext(AuthContext);
  const [searchParams, setSearchParams] = useSearchParams();
  const isCashierOrAdmin = user?.is_admin || user?.role === 'cashier';
  const isApprover = user?.is_approver === true;
  const isHod = user?.role === 'hod';
  const canViewAll = isCashierOrAdmin || isApprover || isHod;
  const [viewAll, setViewAll] = useState(searchParams.get('view') === 'mine' ? false : canViewAll);

  const [ious, setIous] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedOnceRef = useRef(false);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [startDate, setStartDate] = useState(searchParams.get('start_date') || '');
  const [endDate, setEndDate] = useState(searchParams.get('end_date') || '');
  const [dateField, setDateField] = useState(searchParams.get('date_field') || '');
  const [approvedByFilter, setApprovedByFilter] = useState(searchParams.get('approved_by') || '');
  const [spendingFilter, setSpendingFilter] = useState(searchParams.get('spending') || '');
  const [currencyFilter, setCurrencyFilter] = useState(searchParams.get('currency') || '');
  const [deptFilter, setDeptFilter] = useState(searchParams.get('department') || '');
  const [departments, setDepartments] = useState([]);
  const [currencies, setCurrencies] = useState([]);

  const fromDashboard = searchParams.get('from') === 'dashboard';
  const urlStatusParam = searchParams.get('status') || '';
  const [dashboardStatusLocked, setDashboardStatusLocked] = useState(Boolean(fromDashboard && urlStatusParam));

  // Sync filters whenever URL query params change (e.g. navigation from Dashboard)
  useEffect(() => {
    const nextFromDashboard = searchParams.get('from') === 'dashboard';
    const nextUrlStatus = searchParams.get('status') || '';
    setStatusFilter(nextUrlStatus);
    setDashboardStatusLocked(Boolean(nextFromDashboard && nextUrlStatus));
    setSearch(searchParams.get('search') || '');
    setStartDate(searchParams.get('start_date') || '');
    setEndDate(searchParams.get('end_date') || '');
    setDateField(searchParams.get('date_field') || '');
    setApprovedByFilter(searchParams.get('approved_by') || '');
    setSpendingFilter(searchParams.get('spending') || '');
    setCurrencyFilter(searchParams.get('currency') || '');
    setDeptFilter(searchParams.get('department') || '');
    const viewParam = searchParams.get('view');
    if (viewParam === 'mine') setViewAll(false);
    else if (canViewAll) setViewAll(true);
  }, [searchParams, canViewAll]);

  // Load currencies and departments on mount
  useEffect(() => {
    getCurrencies({ include_inactive: 'true' }).then(res => setCurrencies(res.data?.data || [])).catch(() => { });
    getDepartments().then(res => setDepartments(res.data?.data || [])).catch(() => { });
  }, []);

  // Fetch IOUs for non-status filters (debounce search input only; discrete filters fetch immediately).
  // When arrived directly from Dashboard with an explicit ?status=..., fetch that slice cleanly;
  // otherwise fetch full current-scope data so KPI card/breakdown clicks filter instantly without blinking.
  const lockedDashboardStatus = dashboardStatusLocked ? urlStatusParam : '';

  useEffect(() => {
    const delay = search ? 250 : 0;
    const timer = setTimeout(() => {
      fetchIOUs(lockedDashboardStatus);
    }, delay);
    return () => clearTimeout(timer);
  }, [search, startDate, endDate, dateField, approvedByFilter, viewAll, spendingFilter, currencyFilter, deptFilter, canViewAll, lockedDashboardStatus]);

  async function fetchIOUs(serverStatus = '') {
    if (!hasLoadedOnceRef.current) setInitialLoading(true);
    else setRefreshing(true);
    try {
      const params = { limit: 2000 };
      if (search) params.search = search;
      if (serverStatus) params.status = serverStatus;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (dateField) params.date_field = dateField;
      if (approvedByFilter) params.approved_by = approvedByFilter;
      if (spendingFilter) params.spending = spendingFilter;
      if (currencyFilter) params.currency = currencyFilter;
      if (deptFilter) params.department = deptFilter;
      if (canViewAll && viewAll) params.all = true;
      const res = await listIOUs(params);
      setIous(res.data.data || []);
      hasLoadedOnceRef.current = true;
    } catch (err) {
      console.error(err);
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }

  // Filtered table rows based on statusFilter (0ms instant switch, zero skeleton/layout flicker)
  const filteredIous = useMemo(
    () => (statusFilter ? ious.filter(i => matchesIouStatus(i.status, statusFilter)) : ious),
    [ious, statusFilter]
  );

  // Summary statistics computed from current scope (ious) so clickable cards stay stable while filtering
  const totalCount = ious.length;
  const pendingCount = useMemo(() => ious.filter(i => ['PENDING', 'PENDING_HOD_ASSIGNMENT', 'APPROVED', 'APPROVED_FOR_DISBURSEMENT'].includes(i.status)).length, [ious]);
  const activeDisbursedCount = useMemo(() => ious.filter(i => ['DISBURSED', 'DISBURSEMENT_CONFIRMED', 'EXPENSE_SUBMITTED', 'EXPENSE_PENDING_APPROVAL', 'EXPENSE_RETURNED'].includes(i.status)).length, [ious]);
  const redeemedCount = useMemo(() => ious.filter(i => ['RECONCILED', 'REDEEMED'].includes(i.status)).length, [ious]);

  const breakdownSegments = useMemo(() => {
    const countIn = (statuses) => ious.filter(i => statuses.includes(i.status)).length;
    const knownStatuses = [
      'PENDING', 'PENDING_HOD_ASSIGNMENT',
      'APPROVED', 'APPROVED_FOR_DISBURSEMENT',
      'DISBURSED', 'DISBURSEMENT_CONFIRMED', 'EXPENSE_SUBMITTED', 'EXPENSE_PENDING_APPROVAL', 'EXPENSE_RETURNED',
      'RECONCILED', 'REDEEMED',
      'DRAFT', 'RETURNED',
      'REJECTED', 'CANCELLED'
    ];
    const otherCount = ious.filter(i => !knownStatuses.includes(i.status)).length;

    const segments = [
      {
        key: 'pending',
        label: 'Pending Approval',
        count: countIn(['PENDING', 'PENDING_HOD_ASSIGNMENT']),
        status: 'PENDING_GROUP',
        barColor: 'bg-amber-500',
        pillClass: 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
      },
      {
        key: 'ready',
        label: 'Ready to Disburse',
        count: countIn(['APPROVED', 'APPROVED_FOR_DISBURSEMENT']),
        status: 'APPROVED_READY_GROUP',
        barColor: 'bg-indigo-500',
        pillClass: 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100'
      },
      {
        key: 'active',
        label: 'Disbursed / Active',
        count: activeDisbursedCount,
        status: 'ACTIVE_DISBURSED_GROUP',
        barColor: 'bg-blue-500',
        pillClass: 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
      },
      {
        key: 'reconciled',
        label: 'Reconciled',
        count: countIn(['RECONCILED']),
        status: 'RECONCILED',
        barColor: 'bg-teal-500',
        pillClass: 'bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100'
      },
      {
        key: 'redeemed',
        label: 'Redeemed',
        count: countIn(['REDEEMED']),
        status: 'REDEEMED',
        barColor: 'bg-emerald-500',
        pillClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
      },
      {
        key: 'draftReturned',
        label: 'Draft / Returned',
        count: countIn(['DRAFT', 'RETURNED']),
        status: 'DRAFT_RETURNED_GROUP',
        barColor: 'bg-slate-400',
        pillClass: 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
      },
      {
        key: 'rejected',
        label: 'Rejected / Cancelled',
        count: countIn(['REJECTED', 'CANCELLED']),
        status: 'REJECTED_GROUP',
        barColor: 'bg-red-500',
        pillClass: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
      }
    ];
    if (otherCount > 0) {
      segments.push({
        key: 'other',
        label: 'Other',
        count: otherCount,
        status: '',
        barColor: 'bg-purple-400',
        pillClass: 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100'
      });
    }
    return segments;
  }, [ious, activeDisbursedCount]);

  function handleStatusCardFilter(targetStatus) {
    if (dashboardStatusLocked && targetStatus !== urlStatusParam) {
      setDashboardStatusLocked(false);
    }
    if (!targetStatus) {
      setStatusFilter('');
      return;
    }
    setStatusFilter(prev => (prev === targetStatus ? '' : targetStatus));
  }

  const hasActiveFilters = Boolean(search || statusFilter || startDate || endDate || spendingFilter || currencyFilter || deptFilter || approvedByFilter || dateField);
  const hideZeroCards = fromDashboard;

  // Page title according to user role and view mode
  const pageTitle = useMemo(() => {
    if (canViewAll && viewAll) {
      if (isCashierOrAdmin) return 'IOU Requests Registry';
      if (isHod) return 'Department IOU Requests';
      return 'Company IOU Requests';
    }
    return 'My IOU Requests';
  }, [canViewAll, viewAll, isCashierOrAdmin, isHod]);

  const pageSubtitle = useMemo(() => {
    if (canViewAll && viewAll) {
      if (isCashierOrAdmin) return 'Manage and disburse petty cash requests across all departments';
      if (isHod) return 'Tracking requests submitted across your assigned department(s)';
      return 'Viewing all requests submitted across the company';
    }
    return 'Track your personal petty cash advances and reconciliation submissions';
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
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${viewAll ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                  {isHod ? 'Department Requests' : 'All Requests'}
                </button>
                <button
                  type="button"
                  onClick={() => setViewAll(false)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${!viewAll ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                  My Submissions
                </button>
              </div>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">{pageSubtitle}</p>
        </div>
        <Link
          to="/ious/create"
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white hover:text-white hover:text-opacity-50 font-semibold text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2 shrink-0"
        >
          + New Request
        </Link>
      </div>

      {/* Summary KPI Cards (clickable to filter without layout jump or skeleton blink; hide 0-count cards only when routed from Dashboard) */}
      {initialLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-28 rounded-2xl bg-white/70 animate-pulse shadow" />
          ))}
        </div>
      ) : (() => {
        const cards = [
          {
            key: 'total',
            targetStatus: '',
            count: totalCount,
            title: 'Total Requests',
            subtitle: statusFilter ? 'Click to show all' : 'In current view',
            gradient: 'from-slate-700 to-slate-900',
            titleColor: 'text-slate-300',
            subColor: 'text-slate-400',
            iconBg: 'bg-white/10',
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
          },
          {
            key: 'pending',
            targetStatus: 'AWAITING_ACTION_GROUP',
            count: pendingCount,
            title: 'Awaiting Action',
            subtitle: 'Approval or disbursement',
            gradient: 'from-amber-500 to-orange-600',
            titleColor: 'text-amber-100',
            subColor: 'text-amber-100',
            iconBg: 'bg-white/15',
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
          },
          {
            key: 'active',
            targetStatus: 'ACTIVE_DISBURSED_GROUP',
            count: activeDisbursedCount,
            title: 'Disbursed / Active',
            subtitle: 'Funds in circulation',
            gradient: 'from-blue-600 to-indigo-700',
            titleColor: 'text-blue-100',
            subColor: 'text-blue-100',
            iconBg: 'bg-white/15',
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
          },
          {
            key: 'redeemed',
            targetStatus: 'SETTLED_GROUP',
            count: redeemedCount,
            title: 'Settled & Redeemed',
            subtitle: 'Fully closed IOUs',
            gradient: 'from-emerald-600 to-teal-700',
            titleColor: 'text-emerald-100',
            subColor: 'text-emerald-100',
            iconBg: 'bg-white/15',
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
          }
        ].filter(c => !hideZeroCards || c.count > 0);

        const nonZeroSegments = breakdownSegments.filter(s => s.count > 0);
        const showTally = totalCount > 0 && (!hideZeroCards || nonZeroSegments.length > 1);

        if (cards.length === 0 && !showTally) return null;

        const gridCols = cards.length === 1
          ? 'grid-cols-1 max-w-sm'
          : cards.length === 2
            ? 'grid-cols-1 sm:grid-cols-2'
            : cards.length === 3
              ? 'grid-cols-1 sm:grid-cols-3'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';

        return (
          <div className="space-y-4">
            {cards.length > 0 && (
              <div className={`grid ${gridCols} gap-4`}>
                {cards.map(c => {
                  const isActive = c.targetStatus !== '' && statusFilter === c.targetStatus;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => handleStatusCardFilter(c.targetStatus)}
                      title={c.targetStatus ? `Filter by ${c.title}` : 'Show all requests'}
                      className={`text-left w-full cursor-pointer relative overflow-hidden rounded-2xl bg-gradient-to-br ${c.gradient} p-5 shadow-lg hover:shadow-xl hover:brightness-105 transition-[box-shadow,filter] duration-150 focus:outline-none text-white ${isActive ? 'ring-2 ring-slate-900/25 ring-offset-2 ring-offset-slate-100 shadow-xl' : ''}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-medium ${c.titleColor} uppercase tracking-wider`}>{c.title}</span>
                        <div className={`p-1.5 rounded-lg ${c.iconBg}`}>{c.icon}</div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-3xl font-extrabold leading-tight">{c.count}</div>
                        {isActive && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/25 text-white leading-none">
                            Active
                          </span>
                        )}
                      </div>
                      <div className={`text-xs ${c.subColor} mt-1`}>{c.subtitle}</div>
                    </button>
                  );
                })}
              </div>
            )}

            {showTally && (
              <TallyBreakdownBar
                title="IOU Request Breakdown"
                subtitle={statusFilter ? 'Click any stage below to switch filter, or click Total to clear' : 'Complete lifecycle breakdown making up Total Requests'}
                total={totalCount}
                segments={breakdownSegments}
                activeStatus={statusFilter}
                onSegmentClick={(seg) => handleStatusCardFilter(seg.status)}
                onTotalClick={() => setStatusFilter('')}
              />
            )}
          </div>
        );
      })()}

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[220px] relative">
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Search</label>
            <div className="relative">
              <input
                placeholder="Request #, purpose, requester, IFS voucher..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm bg-white"
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
              onChange={e => {
                const next = e.target.value;
                if (dashboardStatusLocked && next !== urlStatusParam) setDashboardStatusLocked(false);
                setStatusFilter(next);
              }}
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
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Spending</label>
            <select
              value={spendingFilter}
              onChange={e => setSpendingFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
            >
              <option value="">All</option>
              <option value="overspent">Overspent</option>
              <option value="underspent">Underspent</option>
              <option value="exact">Exact</option>
            </select>
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

          {(hasActiveFilters || fromDashboard) && (
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('');
                setStartDate('');
                setEndDate('');
                setDateField('');
                setApprovedByFilter('');
                setSpendingFilter('');
                setCurrencyFilter('');
                setDeptFilter('');
                if (canViewAll) setViewAll(true);
                setSearchParams({}, { replace: true });
              }}
              className="px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
            >
              Reset
            </button>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card>
        {initialLoading ? (
          <div className="space-y-3 py-4">
            {[0, 1, 2, 3, 4].map(i => <div key={i} className="h-14 bg-slate-50 rounded-xl animate-pulse" />)}
          </div>
        ) : filteredIous.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <div className="w-12 h-12 mx-auto mb-3 text-slate-300 flex items-center justify-center">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <p className="text-base font-semibold text-slate-600">No IOU requests found</p>
            <p className="text-sm mt-1">Try adjusting your filters or submit a new petty cash request.</p>
            {statusFilter ? (
              <button
                type="button"
                onClick={() => setStatusFilter('')}
                className="text-emerald-600 font-semibold hover:underline text-sm mt-3 inline-block"
              >
                Show all statuses
              </button>
            ) : (
              <Link to="/ious/create" className="text-emerald-600 font-semibold hover:underline text-sm mt-3 inline-block">Create new request &rarr;</Link>
            )}
          </div>
        ) : (
          <div className={`overflow-x-auto transition-opacity duration-150 ${refreshing ? 'opacity-60' : 'opacity-100'}`}>
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-3">Request #</th>
                  <th className="py-3 px-3">Requester</th>
                  <th className="py-3 px-3">Department</th>
                  <th className="py-3 px-3 text-right">Amount</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center">Spending</th>
                  <th className="py-3 px-3">IFS Voucher</th>
                  <th className="py-3 px-3 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredIous.map(iou => {
                  const recon = iou.reconciliation;
                  const expense = (iou.expenses && iou.expenses.length > 0) ? iou.expenses[0] : null;
                  let spendingLabel = null;
                  let spendingClass = '';
                  if (recon && recon.diff_amount !== undefined && recon.diff_amount !== null) {
                    const diff = Number(recon.diff_amount);
                    if (diff > 0) { spendingLabel = 'Overspent'; spendingClass = 'bg-red-100 text-red-700'; }
                    else if (diff < 0) { spendingLabel = 'Underspent'; spendingClass = 'bg-amber-100 text-amber-700'; }
                    else { spendingLabel = 'Exact'; spendingClass = 'bg-emerald-100 text-emerald-700'; }
                  } else if (expense && expense.actual_amount && iou.estimated_amount) {
                    const diff = Number(expense.actual_amount) - Number(iou.estimated_amount);
                    if (diff > 0) { spendingLabel = 'Overspent'; spendingClass = 'bg-red-100 text-red-700'; }
                    else if (diff < 0) { spendingLabel = 'Underspent'; spendingClass = 'bg-amber-100 text-amber-700'; }
                    else { spendingLabel = 'Exact'; spendingClass = 'bg-emerald-100 text-emerald-700'; }
                  }
                  return (
                    <tr key={iou.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-3">
                        <Link to={`/ious/${iou.id}`} className="font-bold text-slate-800 hover:text-emerald-600 transition-colors">
                          {iou.request_number}
                        </Link>
                        <div className="text-xs text-slate-400 line-clamp-1 max-w-[220px]">{iou.purpose}</div>
                      </td>
                      <td className="py-3.5 px-3 font-medium text-slate-700 max-w-[180px] truncate" title={iou.requester?.display_name || iou.requester?.username || '-'}>
                        {iou.requester?.display_name || iou.requester?.username || '-'}
                      </td>
                      <td className="py-3.5 px-3 text-slate-600 max-w-[160px] truncate" title={iou.department || '-'}>{iou.department || '-'}</td>
                      <td className="py-3.5 px-3 text-right font-bold text-slate-800 whitespace-nowrap">{formatCurrency(iou.estimated_amount, iou.currency)}</td>
                      <td className="py-3.5 px-3 text-center"><StatusBadge status={iou.status} /></td>
                      <td className="py-3.5 px-3 text-center">
                        {spendingLabel ? (
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${spendingClass}`}>{spendingLabel}</span>
                        ) : (
                          <span className="text-xs text-slate-300">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3">
                        <IfsVoucherDisplay
                          activeVoucher={iou.ifs_voucher_number}
                          cancelledVouchers={iou.cancelled_ifs_vouchers}
                          compact
                        />
                      </td>
                      <td className="py-3.5 px-3 text-right text-slate-400 text-xs">{shortDate(iou.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
