// src/pages/Dashboard.jsx
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { exportIOUs, getDateLimit } from '../services/iouService';
import Card from '../components/ui/Card';
import { AuthContext } from '../contexts/AuthContext';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

/* Sparkline */
function Sparkline({ data = [], width = 120, height = 28, stroke = '#065f46' }) {
  if (!data || data.length === 0) return <svg width={width} height={height} />;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / (max - min || 1)) * height;
    return `${x},${y}`;
  }).join(' ');
  const d = `M0 ${height} L${pts} L${width} ${height} Z`;
  return (
    <svg width={width} height={height}>
      <path d={d} fill={stroke} opacity="0.08" />
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* Donut */
function Donut({ value = 0, total = 1, size = 56, strokeWidth = 8, color = '#4f46e5' }) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, total === 0 ? 0 : value / total));
  const dash = c * pct;
  return (
    <svg width={size} height={size}>
      <g transform={`translate(${size / 2},${size / 2})`}>
        <circle r={r} cx="0" cy="0" fill="none" stroke="#eef2ff" strokeWidth={strokeWidth} />
        <circle
          r={r}
          cx="0"
          cy="0"
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${dash} ${c - dash}`}
          strokeLinecap="round"
          transform="rotate(-90)"
        />
        <text x="0" y="4" textAnchor="middle" fontSize="10" fill="#111" fontWeight="600">
          {Math.round(pct * 100)}%
        </text>
      </g>
    </svg>
  );
}

function formatCurrency(n, currency = 'GHS') {
  if (n == null) return `${currency} 0.00`;
  const localeMap = { GHS: 'en-GH', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB' };
  return new Intl.NumberFormat(localeMap[currency] || 'en-US', { style: 'currency', currency }).format(n);
}

const CURRENCY_SYMBOLS = { GHS: 'GH₵', USD: '$', EUR: '€', GBP: '£' };
const CURRENCY_COLORS = { GHS: '#065f46', USD: '#1d4ed8', EUR: '#7c3aed', GBP: '#be185d' };

function shortDate(dt) {
  if (!dt) return '-';
  const d = new Date(dt);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function StatusBadge({ status }) {
  const s = (status || '').toUpperCase();
  const map = {
    DRAFT: ['bg-slate-100 text-slate-700', 'Draft'],
    PENDING_HOD_ASSIGNMENT: ['bg-indigo-100 text-indigo-800', 'Awaiting Assignment'],
    PENDING: ['bg-amber-100 text-amber-800', 'Pending'],
    APPROVED: ['bg-emerald-100 text-emerald-800', 'Approved'],
    APPROVED_FOR_DISBURSEMENT: ['bg-emerald-100 text-emerald-800', 'Approved'],
    DISBURSED: ['bg-blue-100 text-blue-800', 'Disbursed'],
    DISBURSEMENT_CONFIRMED: ['bg-blue-200 text-blue-900', 'Funds Confirmed'],
    EXPENSE_SUBMITTED: ['bg-purple-100 text-purple-800', 'Expense Submitted'],
    EXPENSE_PENDING_APPROVAL: ['bg-orange-100 text-orange-800', 'Expense Approval'],
    RECONCILED: ['bg-teal-100 text-teal-800', 'Reconciled'],
    REDEEMED: ['bg-green-100 text-green-800', 'Redeemed'],
    RETURNED: ['bg-yellow-50 text-yellow-800', 'Returned'],
    REJECTED: ['bg-red-100 text-red-700', 'Rejected'],
    CANCELLED: ['bg-gray-100 text-gray-600', 'Cancelled']
  };
  const [cls, label] = map[s] || ['bg-slate-100 text-slate-700', s || '-'];
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}

export default function Dashboard() {
  const { user } = useContext(AuthContext);
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [ious, setIous] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState(null);

  // filter state: query is used for backend; localSearch updates immediately
  const [statusFilter, setStatusFilter] = useState('');
  const [searchLocal, setSearchLocal] = useState('');
  const [query, setQuery] = useState(''); // debounced query sent to backend
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [viewModeAll, setViewModeAll] = useState(false); // admin/approver toggle
  const [showApprovedByMe, setShowApprovedByMe] = useState(false);
  const [spendingFilter, setSpendingFilter] = useState(''); // overspent / underspent / exact

  // Admin-controlled date limit
  const [minDateLimit, setMinDateLimit] = useState(null); // Date object or null
  const todayDate = new Date();
  todayDate.setHours(23, 59, 59, 999);

  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState('');

  const debounceRef = useRef(null);
  const reloadIntervalRef = useRef(null);

  // Determine user role capabilities
  const isCashierOrAdmin = user?.is_admin || user?.role === 'cashier';
  const isApprover = user?.is_approver === true;
  const canSeeAll = isCashierOrAdmin || isApprover;
  const canExport = isCashierOrAdmin || isApprover;

  // Set viewModeAll default for cashiers/admins/approvers
  useEffect(() => {
    if (canSeeAll) {
      setViewModeAll(true);
    }
  }, [canSeeAll]);

  // Fetch admin date limit on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await getDateLimit();
        if (res.data?.min_date) {
          setMinDateLimit(new Date(res.data.min_date));
        }
      } catch (_) {
        // Default: first day of current month
        const now = new Date();
        setMinDateLimit(new Date(now.getFullYear(), now.getMonth(), 1));
      }
    })();
  }, []);

  // Local immediate filter for UX - compute filteredIous using searchLocal (client-side)
  const filteredIousLocal = useMemo(() => {
    const q = (searchLocal || '').trim().toLowerCase();
    if (!q) return ious;
    return ious.filter(i => {
      const rn = (i.request_number || '').toString().toLowerCase();
      const purpose = (i.purpose || '').toString().toLowerCase();
      const requester = ((i.requester && i.requester.display_name) || i.requester_name || '').toString().toLowerCase();
      return rn.includes(q) || purpose.includes(q) || requester.includes(q);
    });
  }, [ious, searchLocal]);

  // Debounce the searchLocal into query that will trigger backend fetch
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setQuery(searchLocal.trim());
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchLocal]);

  useEffect(() => {
    // whenever startDate/endDate changes, we also debounce to the query state (so backend sees date changes)
    // small debounce to avoid flooding when user picks dates quickly
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      // re-run backend fetch by setting query to itself (triggers effect below because deps include date/status/flags)
      setQuery(prev => prev);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, statusFilter, viewModeAll, showApprovedByMe, spendingFilter]);

  // load data from backend when query (debounced search) or other filters change
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    async function load() {
      try {
        const params = {
          limit: 200,
          status: statusFilter || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          search: query || undefined,
          spending: spendingFilter || undefined
        };

        if (canSeeAll && viewModeAll) params.all = true;
        if (showApprovedByMe) params.approved_by = user?.id;

        const [rIous, rApps, rNotes] = await Promise.all([
          api.get('/ious', { params }),
          api.get('/approvals/mine').catch(() => ({ data: { data: [] } })),
          api.get('/notifications', { params: { unread: true, limit: 6 } }).catch(() => ({ data: { data: [] } }))
        ]);

        if (!mounted) return;
        setIous(rIous.data.data || []);
        setApprovals(rApps.data.data || []);
        setNotifications(rNotes.data.data || []);
      } catch (err) {
        console.error('Dashboard load error', err);
        if (mounted) setError(err?.response?.data?.message || 'Failed to load dashboard');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    // live refresh every 30s
    if (reloadIntervalRef.current) clearInterval(reloadIntervalRef.current);
    reloadIntervalRef.current = setInterval(() => {
      load().catch(() => {});
    }, 30000);

    return () => {
      mounted = false;
      if (reloadIntervalRef.current) clearInterval(reloadIntervalRef.current);
    };
    // include only the meaningful deps (query is debounced)
  }, [user, statusFilter, query, startDate, endDate, viewModeAll, showApprovedByMe, canSeeAll, spendingFilter]);

  // Determine if filters are applied
  const filtersApplied = !!(startDate || endDate || statusFilter || searchLocal.trim() || showApprovedByMe);

  // KPIs computed off the current (server) ious
  const kpis = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    let pendingCount = 0;
    let approvedThisMonth = 0;
    // Multi-currency approved amounts
    const approvedAmountByCurrency = {};
    let disbursedCount = 0;
    let awaitingDisbursement = 0;
    let expenseSubmittedCount = 0;
    const perDay = new Array(7).fill(0);
    const dayMs = 24 * 3600 * 1000;
    const today0 = new Date();
    today0.setHours(0, 0, 0, 0);

    for (const i of ious) {
      if (i.status === 'PENDING' || i.status === 'PENDING_HOD_ASSIGNMENT') pendingCount++;
      if (i.status === 'APPROVED_FOR_DISBURSEMENT') awaitingDisbursement++;
      if (i.status === 'EXPENSE_SUBMITTED') expenseSubmittedCount++;
      if (i.status === 'DISBURSED') {
        const created = i.updated_at || i.created_at;
        if (created) {
          const d = new Date(created);
          if (filtersApplied || (d.getMonth() === month && d.getFullYear() === year)) disbursedCount++;
        }
      }
      if (['APPROVED', 'APPROVED_FOR_DISBURSEMENT', 'DISBURSED', 'DISBURSEMENT_CONFIRMED', 'EXPENSE_PENDING_APPROVAL', 'EXPENSE_SUBMITTED', 'EXPENSE_RETURNED', 'RECONCILED', 'REDEEMED'].includes(i.status)) {
        const created = i.updated_at || i.created_at || i.submitted_at;
        if (created) {
          const d = new Date(created);
          // When filters are applied, count all IOUs from server (already filtered)
          // When no filters, only count current month
          const shouldCount = filtersApplied || (d.getMonth() === month && d.getFullYear() === year);
          if (shouldCount) {
            approvedThisMonth++;
            if (i.estimated_amount) {
              const cur = i.currency || 'GHS';
              approvedAmountByCurrency[cur] = (approvedAmountByCurrency[cur] || 0) + (Number(i.estimated_amount) || 0);
            }
          }
          const diff = Math.floor((today0 - (new Date(created)).setHours(0, 0, 0, 0)) / dayMs);
          if (diff >= 0 && diff < 7) {
            perDay[6 - diff] += 1;
          }
        }
      }
    }

    return { pendingCount, approvedThisMonth, approvedAmountByCurrency, disbursedCount, awaitingDisbursement, expenseSubmittedCount, sparkData: perDay };
  }, [ious, filtersApplied]);

  // Total count of IOUs (reflects current filters)
  const totalCount = filteredIousLocal.length;

  // Dynamic KPI labels
  const approvedLabel = useMemo(() => {
    if (startDate && endDate) return `Value of approved IOUs (${formatDateLabel(startDate)} – ${formatDateLabel(endDate)})`;
    if (startDate) return `Value of approved IOUs (from ${formatDateLabel(startDate)})`;
    if (endDate) return `Value of approved IOUs (up to ${formatDateLabel(endDate)})`;
    return 'Value of approved IOUs this month';
  }, [startDate, endDate]);

  const countLabel = useMemo(() => {
    if (filtersApplied) return 'Matching current filters';
    if (canSeeAll && viewModeAll) return 'All IOUs across the company';
    return 'All your IOUs';
  }, [filtersApplied, canSeeAll, viewModeAll]);

  // Export handler
  async function handleExport() {
    setExportMsg('');
    if (filteredIousLocal.length === 0) {
      setExportMsg('ℹ️ There are no IOUs matching the current filters to export.');
      return;
    }
    setExporting(true);
    try {
      const params = {};
      if (searchLocal.trim()) params.search = searchLocal.trim();
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (statusFilter) params.status = statusFilter;
      if (spendingFilter) params.spending = spendingFilter;
      if (canSeeAll && viewModeAll) params.all = true;
      if (showApprovedByMe) params.approved_by = user?.id;

      const res = await exportIOUs(params);
      // Create download link from blob
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().slice(0, 10);
      a.download = `ious_export_${timestamp}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setExportMsg('✅ Export downloaded successfully.');
    } catch (err) {
      console.error('Export error', err);
      let msg = err?.response?.data?.message || 'Export failed. Please try again.';
      // If response is blob, try to read it
      if (err?.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          msg = json.message || msg;
        } catch (_) {}
      }
      if (msg.toLowerCase().includes('no ious found')) {
        setExportMsg(`ℹ️ ${msg}`);
      } else {
        setExportMsg(`❌ ${msg}`);
      }
    } finally {
      setExporting(false);
    }
  }

  // Date picker helpers
  const startDateObj = startDate ? new Date(startDate) : null;
  const endDateObj = endDate ? new Date(endDate) : null;

  function handleStartDateChange(date) {
    setStartDate(date ? date.toISOString().slice(0, 10) : '');
  }
  function handleEndDateChange(date) {
    setEndDate(date ? date.toISOString().slice(0, 10) : '');
  }

  // Currency entries for the approved amount card
  const currencyEntries = Object.entries(kpis.approvedAmountByCurrency || {}).filter(([_, v]) => v > 0);

  // while loading show skeleton but don't disrupt searchLocal focus
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-28 bg-white/80 rounded-xl p-6 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 bg-white/80 rounded-xl p-6 animate-pulse" />
          <div className="h-80 bg-white/80 rounded-xl p-6 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded">{error}</div>}

      {/* KPIs responsive - 4 columns */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total IOUs Count */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-400">Total IOUs</div>
              <div className="text-3xl font-bold text-slate-800">{totalCount}</div>
              <div className="text-xs text-slate-500 mt-1">{countLabel}</div>
            </div>
            <div className="p-2 rounded-full bg-slate-100">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-slate-500">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </Card>

        {/* Pending IOUs */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-400">Pending IOUs</div>
              <div className="text-3xl font-bold text-emerald-700">{kpis.pendingCount}</div>
              <div className="text-xs text-slate-500 mt-1">Requests awaiting approval</div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Sparkline data={kpis.sparkData} />
              <div className="text-xs text-slate-400">Last 7 days</div>
            </div>
          </div>
        </Card>

        {/* Approved (this month / filtered period) */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-400">
                {filtersApplied ? 'Approved (filtered)' : 'Approved (this month)'}
              </div>
              <div className="text-3xl font-bold text-sky-700">{kpis.approvedThisMonth}</div>
              <div className="text-xs text-slate-500 mt-1">
                {filtersApplied ? 'Approvals in filtered period' : 'Approvals completed this month'}
              </div>
            </div>
            <div>
              <Donut value={kpis.approvedThisMonth} total={Math.max(1, ious.length || 1)} />
            </div>
          </div>
        </Card>

        {/* Multi-Currency Approved Amount */}
        <Card>
          <div>
            <div className="text-sm text-slate-400">Approved Amount</div>
            {currencyEntries.length === 0 ? (
              <div className="text-2xl font-bold text-indigo-700 mt-1">{formatCurrency(0, 'GHS')}</div>
            ) : (
              <div className="mt-1 space-y-1.5 max-h-[80px] overflow-y-auto pr-1">
                {currencyEntries.map(([cur, amt]) => (
                  <div key={cur} className="flex items-center justify-between gap-2">
                    <span
                      className="text-xs font-semibold px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: (CURRENCY_COLORS[cur] || '#4f46e5') + '18', color: CURRENCY_COLORS[cur] || '#4f46e5' }}
                    >
                      {cur}
                    </span>
                    <span className="text-lg font-bold" style={{ color: CURRENCY_COLORS[cur] || '#4f46e5' }}>
                      {formatCurrency(amt, cur)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="text-xs text-slate-500 mt-1.5">{approvedLabel}</div>
          </div>
        </Card>
      </section>

      {/* Filters bar */}
      <div className="flex flex-wrap items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          <input
            placeholder="Search request #, purpose, requester..."
            value={searchLocal}
            onChange={e => setSearchLocal(e.target.value)}
            className="px-3 py-2 rounded border w-full md:w-72"
            autoComplete="off"
          />

          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 rounded border">
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING_HOD_ASSIGNMENT">Awaiting Assignment</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED_FOR_DISBURSEMENT">Approved</option>
            <option value="DISBURSED">Disbursed</option>
            <option value="EXPENSE_SUBMITTED">Expense Submitted</option>
            <option value="RECONCILED">Reconciled</option>
            <option value="REDEEMED">Redeemed</option>
            <option value="REJECTED">Rejected</option>
            <option value="RETURNED">Returned</option>
          </select>

          <select value={spendingFilter} onChange={e => setSpendingFilter(e.target.value)} className="px-3 py-2 rounded border">
            <option value="">All spending</option>
            <option value="overspent">Overspent</option>
            <option value="underspent">Underspent</option>
            <option value="exact">Exact</option>
          </select>

          <button onClick={() => { setSearchLocal(''); setStatusFilter(''); setStartDate(''); setEndDate(''); setShowApprovedByMe(false); setSpendingFilter(''); }} className="px-3 py-2 rounded border hidden md:inline">Reset</button>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          <label className="text-xs text-slate-500 flex flex-col">
            <span className="text-[11px] text-slate-400">From</span>
            <DatePicker
              selected={startDateObj}
              onChange={handleStartDateChange}
              minDate={minDateLimit}
              maxDate={todayDate}
              dateFormat="yyyy-MM-dd"
              placeholderText="Start date"
              className="px-3 py-2 rounded border text-sm w-36"
              portalId="datepicker-portal"
              isClearable
            />
          </label>

          <label className="text-xs text-slate-500 flex flex-col">
            <span className="text-[11px] text-slate-400">To</span>
            <DatePicker
              selected={endDateObj}
              onChange={handleEndDateChange}
              minDate={startDateObj || minDateLimit}
              maxDate={todayDate}
              dateFormat="yyyy-MM-dd"
              placeholderText="End date"
              className="px-3 py-2 rounded border text-sm w-36"
              portalId="datepicker-portal"
              isClearable
            />
          </label>

          {canSeeAll && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={viewModeAll} onChange={e => setViewModeAll(e.target.checked)} />
              View all IOUs
            </label>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showApprovedByMe} onChange={e => setShowApprovedByMe(e.target.checked)} />
            Show IOUs I've approved
          </label>

          {/* Export button */}
          {canExport && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-700 text-white text-sm font-medium hover:from-blue-600 hover:to-blue-800 transition-all disabled:opacity-50 shadow-sm"
              title="Export redeemed IOUs to Excel"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {exporting ? 'Exporting...' : 'Export'}
            </button>
          )}
        </div>
      </div>

      {/* Export message */}
      {exportMsg && (
        <div className={`text-sm p-3 rounded-lg border ${exportMsg.startsWith('✅') ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : exportMsg.startsWith('❌') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
          {exportMsg}
          <button onClick={() => setExportMsg('')} className="ml-3 text-xs underline opacity-60">dismiss</button>
        </div>
      )}

      {/* Main grid responsive */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card title="Quick Actions">
            <div className="flex flex-wrap gap-3">
              <Link to="/ious/create" className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-700 text-white">Request IOU</Link>
              <Link to="/approvals" className="px-4 py-2 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-700">My Approvals</Link>
            </div>
          </Card>

          <Card title="Recent Requests">
            {filteredIousLocal.length === 0 ? (
              <div className="text-sm text-slate-500">No IOUs found with the current filters.</div>
            ) : (
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-slate-500 text-xs uppercase">
                    <tr>
                      <th className="text-left py-2">Request</th>
                      <th className="text-left py-2">Requester</th>
                      <th className="text-left py-2">Amount</th>
                      <th className="text-left py-2">Status</th>
                      <th className="text-left py-2">Spending</th>
                      <th className="text-right py-2">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIousLocal.map(i => {
                      // Determine spending outcome from reconciliation or expense data
                      const recon = i.reconciliation;
                      const expense = (i.expenses && i.expenses.length > 0) ? i.expenses[0] : null;
                      let spendingLabel = null;
                      let spendingClass = '';
                      if (recon && recon.diff_amount !== undefined && recon.diff_amount !== null) {
                        const diff = Number(recon.diff_amount);
                        if (diff > 0) {
                          spendingLabel = 'Overspent';
                          spendingClass = 'bg-red-100 text-red-700';
                        } else if (diff < 0) {
                          spendingLabel = 'Underspent';
                          spendingClass = 'bg-amber-100 text-amber-700';
                        } else {
                          spendingLabel = 'Exact';
                          spendingClass = 'bg-emerald-100 text-emerald-700';
                        }
                      } else if (expense && expense.actual_amount && i.estimated_amount) {
                        const diff = Number(expense.actual_amount) - Number(i.estimated_amount);
                        if (diff > 0) {
                          spendingLabel = 'Overspent';
                          spendingClass = 'bg-red-100 text-red-700';
                        } else if (diff < 0) {
                          spendingLabel = 'Underspent';
                          spendingClass = 'bg-amber-100 text-amber-700';
                        } else {
                          spendingLabel = 'Exact';
                          spendingClass = 'bg-emerald-100 text-emerald-700';
                        }
                      }
                      return (
                        <tr key={i.id} className="border-t hover:bg-slate-50">
                          <td className="py-3">
                            <Link to={`/ious/${i.id}`} className="font-medium text-slate-800 underline">{i.request_number}</Link>
                            <div className="text-xs text-slate-500 line-clamp-2">{i.purpose}</div>
                          </td>
                          <td className="py-3">{ (i.requester && i.requester.display_name) || i.requester_name || i.requester_id }</td>
                          <td className="py-3">{ formatCurrency(i.estimated_amount, i.currency) }</td>
                          <td className="py-3"><StatusBadge status={i.status} /></td>
                          <td className="py-3">
                              {spendingLabel ? (
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${spendingClass}`}>
                                  {spendingLabel}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>
                          <td className="py-3 text-right text-xs text-slate-500">{ shortDate(i.created_at || i.submitted_at || i.updated_at) }</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-3 text-right"><Link to="/ious" className="text-sm text-emerald-600">See all →</Link></div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Pending Approvals">
            {approvals.length === 0 ? <div className="text-sm text-slate-500">No pending approvals</div> :
              approvals.slice(0,6).map(a => (
                <div key={a.id} className="flex items-start justify-between p-3 border rounded">
                  <div>
                    <div className="font-medium">IOU: <Link to={`/ious/${a.iou_id}`} className="text-emerald-600 hover:underline">{a.iou?.request_number || a.iou_id}</Link></div>
                    <div className="text-xs text-slate-500">Step {a.step_order} • {shortDate(a.created_at)}</div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button onClick={() => nav(`/ious/${a.iou_id}`)} className="px-3 py-1 rounded bg-emerald-600 text-white text-sm">Open</button>
                    <div className="text-xs text-slate-400">{a.decision}</div>
                  </div>
                </div>
              ))
            }
            <div className="mt-3 text-right"><Link to="/approvals" className="text-sm text-emerald-600">View all approvals</Link></div>
          </Card>

          <Card title="Activity">
            {notifications.length === 0 ? <div className="text-sm text-slate-500">No recent activity.</div> :
              <ul className="space-y-3 text-sm">
                {notifications.slice(0,6).map(n => (
                  <li key={n.id} className="flex justify-between items-start gap-3">
                    <div>
                      <div className="font-medium text-slate-800">{n.title}</div>
                      <div className="text-xs text-slate-500">{n.body}</div>
                    </div>
                    <div className="text-xs text-slate-400">{ shortDate(n.created_at) }</div>
                  </li>
                ))}
              </ul>
            }
            <div className="mt-3 text-right"><Link to="/notifications" className="text-sm text-emerald-600">See all</Link></div>
          </Card>
        </div>
      </section>
    </div>
  );
}
