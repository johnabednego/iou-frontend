// src/pages/Dashboard.jsx
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { exportIOUs, getDateLimit, getDashboardAnalytics, getCurrencies, getFundBalances, getDepartments } from '../services/iouService';
import Card from '../components/ui/Card';
import { AuthContext } from '../contexts/AuthContext';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import MonthlyIOUChart from '../components/charts/MonthlyIOUChart';
import WeeklyTrendChart from '../components/charts/WeeklyTrendChart';
import SpendingPieChart from '../components/charts/SpendingPieChart';
import StatusDistributionChart from '../components/charts/StatusDistributionChart';
import ApprovedAmountsChart from '../components/charts/ApprovedAmountsChart';
import DepartmentIOUChart from '../components/charts/DepartmentIOUChart';

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
  const [currencyFilter, setCurrencyFilter] = useState(''); // currency code filter
  const [departmentFilter, setDepartmentFilter] = useState(''); // department filter
  const [departmentList, setDepartmentList] = useState([]);

  // Analytics data for charts
  const [analytics, setAnalytics] = useState(null);
  const [currencies, setCurrencies] = useState([]);
  const [fundBalances, setFundBalances] = useState([]);

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
  const isHod = user?.role === 'hod';
  const canSeeAll = isCashierOrAdmin || isApprover;
  const canExport = isCashierOrAdmin || isApprover || isHod;
  const canSeeAnalytics = canSeeAll || isHod;

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

  // Fetch analytics, currencies, departments, and fund balances
  useEffect(() => {
    (async () => {
      try {
        const [aRes, cRes, dRes] = await Promise.all([
          getDashboardAnalytics({ department: departmentFilter || undefined }).catch(() => ({ data: { data: null } })),
          getCurrencies({ include_inactive: 'true' }).catch(() => ({ data: { data: [] } })),
          getDepartments().catch(() => ({ data: { data: [] } }))
        ]);
        setAnalytics(aRes.data?.data || null);
        setCurrencies(cRes.data?.data || []);
        setDepartmentList(dRes.data?.data || []);
      } catch (_) {}

      // Fund balances (privileged only)
      if (canSeeAll) {
        try {
          const fRes = await getFundBalances();
          setFundBalances(fRes.data?.data || []);
        } catch (_) {}
      }
    })();
  }, [canSeeAll, departmentFilter]);

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
  }, [startDate, endDate, statusFilter, viewModeAll, showApprovedByMe, spendingFilter, currencyFilter, departmentFilter]);

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
          spending: spendingFilter || undefined,
          currency: currencyFilter || undefined,
          department: departmentFilter || undefined
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
  }, [user, statusFilter, query, startDate, endDate, viewModeAll, showApprovedByMe, canSeeAll, spendingFilter, currencyFilter, departmentFilter]);

  // Determine if filters are applied
  const filtersApplied = !!(startDate || endDate || statusFilter || searchLocal.trim() || showApprovedByMe || departmentFilter || spendingFilter || currencyFilter);

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
    if (startDate && endDate) return `Value of approved IOUs (${formatDateLabel(startDate)} - ${formatDateLabel(endDate)})`;
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
      setExportMsg('There are no IOUs matching the current filters to export.');
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
      if (currencyFilter) params.currency = currencyFilter;
      if (departmentFilter) params.department = departmentFilter;
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
      setExportMsg('Export downloaded successfully.');
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
        setExportMsg(msg);
      } else {
        setExportMsg(msg);
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

  // Approved amounts currency visibility:
  // If a currency is deactivated and its approved amount is 0, it should NOT be visible.
  // Active currencies remain visible, and deactivated currencies with approved amount > 0 remain visible.
  const currencyEntries = useMemo(() => {
    const codeSet = new Set();
    if (currencies && currencies.length > 0) {
      currencies.forEach(c => codeSet.add(c.code));
    } else {
      ['GHS', 'USD', 'EUR', 'GBP'].forEach(c => codeSet.add(c));
    }
    if (kpis.approvedAmountByCurrency) {
      Object.keys(kpis.approvedAmountByCurrency).forEach(c => codeSet.add(c));
    }

    const order = ['GHS', 'USD', 'EUR', 'GBP'];
    const entries = [];

    for (const code of codeSet) {
      const currObj = currencies.find(c => c.code === code);
      const isActive = currObj ? !!currObj.is_active : (currencies.length === 0);
      const amt = (kpis.approvedAmountByCurrency || {})[code] || 0;

      // Rule: if deactivated and approved amount is 0, hide it!
      if (!isActive && amt <= 0) {
        continue;
      }

      entries.push([code, amt]);
    }

    entries.sort(([a], [b]) => {
      const idxA = order.indexOf(a);
      const idxB = order.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    return entries;
  }, [currencies, kpis.approvedAmountByCurrency]);

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
      {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">{error}</div>}

      {/* === Hero Welcome Banner === */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 via-[#1F5AA5] to-[#1F88E5] px-6 py-8 shadow-xl">
        {/* Decorative shapes */}
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/5 rounded-full blur-xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full blur-lg" />
        <div className="absolute top-1/2 right-1/4 w-20 h-20 bg-white/5 rounded-full blur-md" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">
              Welcome back, {user?.display_name?.split(' ')[0] || user?.username || 'User'}
            </h1>
            <p className="text-indigo-200 text-sm mt-1">
              Here's your IOU overview {filtersApplied ? '(filtered)' : 'for today'}.
            </p>
          </div>
          <Link
            to="/ious/create"
            className="px-5 py-2.5 rounded-xl bg-white/15 backdrop-blur-sm border border-white/25 text-white text-sm font-semibold hover:bg-white/25 transition-all shadow-sm flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New IOU Request
          </Link>
        </div>
      </section>

      {/* === KPI Cards === */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total IOUs */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 p-5 shadow-lg hover:shadow-xl transition-shadow group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/5 rounded-full group-hover:scale-110 transition-transform" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-white/10">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total IOUs</span>
            </div>
            <div className="text-3xl font-extrabold text-white">{totalCount}</div>
            <div className="text-xs text-slate-400 mt-1">{countLabel}</div>
          </div>
        </div>

        {/* Pending IOUs */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-5 shadow-lg hover:shadow-xl transition-shadow group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full group-hover:scale-110 transition-transform" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-white/15">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <span className="text-xs font-medium text-amber-100 uppercase tracking-wider">Pending</span>
            </div>
            <div className="text-3xl font-extrabold text-white">{analytics?.pendingTotal ?? kpis.pendingCount}</div>
            <div className="text-xs text-amber-100 mt-1">Awaiting approval</div>
          </div>
          <div className="absolute bottom-3 right-4 z-10">
            <Sparkline data={kpis.sparkData} stroke="#fff" width={80} height={24} />
          </div>
        </div>

        {/* Approved this month */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500 to-blue-700 p-5 shadow-lg hover:shadow-xl transition-shadow group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full group-hover:scale-110 transition-transform" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-white/15">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <span className="text-xs font-medium text-sky-100 uppercase tracking-wider">
                {filtersApplied ? 'Approved' : 'This Month'}
              </span>
            </div>
            <div className="text-3xl font-extrabold text-white">{kpis.approvedThisMonth}</div>
            <div className="text-xs text-sky-100 mt-1">{filtersApplied ? 'In filtered period' : 'Approvals completed'}</div>
          </div>
          <div className="absolute bottom-3 right-4 z-10">
            <Donut value={kpis.approvedThisMonth} total={Math.max(1, ious.length || 1)} color="#fff" />
          </div>
        </div>

        {/* Multi-Currency Approved Amount */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 p-5 shadow-lg hover:shadow-xl transition-shadow group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full group-hover:scale-110 transition-transform" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-lg bg-white/15">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
                </svg>
              </div>
              <span className="text-xs font-medium text-emerald-100 uppercase tracking-wider">Approved Amount</span>
            </div>
            <div className="space-y-1 max-h-[72px] overflow-y-auto pr-1">
              {currencyEntries.length === 0 ? (
                <div className="text-sm text-emerald-100/80 italic py-1">No approved amounts</div>
              ) : (
                currencyEntries.map(([cur, amt]) => (
                  <div key={cur} className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-200 bg-white/10 px-1.5 py-0.5 rounded">{cur}</span>
                    <span className="text-sm font-bold text-white">{formatCurrency(amt, cur)}</span>
                  </div>
                ))
              )}
            </div>
            <div className="text-xs text-emerald-200 mt-1">{approvedLabel}</div>
          </div>
        </div>
      </section>

      {/* === Fund Balances - Privileged Only === */}
      {canSeeAll && fundBalances.length > 0 && (
        <section>
          <div className="rounded-2xl bg-white/60 backdrop-blur-md border border-white/40 shadow-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-100">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#065f46" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                  </svg>
                </div>
                <span className="text-sm font-bold text-slate-700">Available Fund Balances</span>
              </div>
              <Link to="/fund-management" className="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:underline transition-colors">
                Manage Funds &rarr;
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {fundBalances.map(fb => {
                const amt = Number(fb.available_amount) || 0;
                const isLow = amt < 1000;
                const isNeg = amt < 0;
                const color = CURRENCY_COLORS[fb.currency] || '#6366f1';
                return (
                  <div
                    key={fb.currency}
                    className="rounded-xl border p-3 transition-all hover:shadow-md"
                    style={{ borderLeftWidth: 4, borderLeftColor: color, backgroundColor: isNeg ? '#fef2f2' : isLow ? '#fffbeb' : '#f0fdf4' }}
                  >
                    <div className="text-xs font-bold" style={{ color }}>{fb.currency}</div>
                    <div className={`text-lg font-extrabold ${isNeg ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-emerald-700'}`}>
                      {formatCurrency(amt, fb.currency)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* === Charts Section - Privileged & HOD Users === */}
      {analytics && canSeeAnalytics && (
        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-indigo-500 to-blue-600" />
            <h2 className="text-lg font-bold text-slate-800">Analytics & Insights</h2>
          </div>

          {/* Row 1: Monthly IOUs + Spending Pie */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2">
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0f172a] border border-indigo-500/30 shadow-xl p-6 group">
                <div className="absolute -right-8 -top-8 w-32 h-32 bg-indigo-500/10 rounded-full group-hover:scale-110 transition-transform pointer-events-none blur-xl" />
                <div className="relative z-10">
                  <div className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]" />
                    <span>IOUs by Month (Last 12 Months)</span>
                  </div>
                  <MonthlyIOUChart data={analytics.iousByMonth} />
                </div>
              </div>
            </div>
            <div>
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f172a] via-[#2e1065] to-[#0f172a] border border-purple-500/30 shadow-xl p-6 h-full group">
                <div className="absolute -right-8 -top-8 w-32 h-32 bg-purple-500/10 rounded-full group-hover:scale-110 transition-transform pointer-events-none blur-xl" />
                <div className="relative z-10">
                  <div className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]" />
                    <span>Spending Breakdown</span>
                  </div>
                  <SpendingPieChart data={analytics.spendingBreakdown} />
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Weekly Trend + Status Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f172a] via-[#064e3b] to-[#0f172a] border border-emerald-500/30 shadow-xl p-6 group">
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-emerald-500/10 rounded-full group-hover:scale-110 transition-transform pointer-events-none blur-xl" />
              <div className="relative z-10">
                <div className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                  <span>Weekly Trend (Last 8 Weeks)</span>
                </div>
                <WeeklyTrendChart data={analytics.iousByWeek} />
              </div>
            </div>
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f172a] via-[#451a03] to-[#0f172a] border border-amber-500/30 shadow-xl p-6 group">
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-amber-500/10 rounded-full group-hover:scale-110 transition-transform pointer-events-none blur-xl" />
              <div className="relative z-10">
                <div className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                  <span>Status Distribution</span>
                </div>
                <StatusDistributionChart data={analytics.statusDistribution} />
              </div>
            </div>
          </div>

          {/* Row 3: Approved Amounts by Currency */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f172a] via-[#134e4a] to-[#0f172a] border border-teal-500/30 shadow-xl p-6 group">
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-teal-500/10 rounded-full group-hover:scale-110 transition-transform pointer-events-none blur-xl" />
            <div className="relative z-10">
              <div className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.8)]" />
                <span>Approved Amounts by Currency</span>
              </div>
              <ApprovedAmountsChart
                amounts={analytics.approvedAmounts}
                monthlyChart={analytics.monthlyApprovedChart}
                currencies={currencies}
              />
            </div>
          </div>

          {/* Row 4: Department Distribution */}
          {analytics.departmentBreakdown && analytics.departmentBreakdown.length > 0 && (
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0f172a] border border-blue-500/30 shadow-xl p-6 group">
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-blue-500/10 rounded-full group-hover:scale-110 transition-transform pointer-events-none blur-xl" />
              <div className="relative z-10">
                <div className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
                  <span>Department Distribution</span>
                </div>
                <DepartmentIOUChart data={analytics.departmentBreakdown} />
              </div>
            </div>
          )}
        </section>
      )}

      {/* === Filter Bar === */}
      <section className="rounded-2xl bg-white/60 backdrop-blur-md border border-white/40 shadow-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 rounded-full bg-gradient-to-b from-emerald-500 to-teal-600" />
          <h2 className="text-lg font-bold text-slate-800">Recent Activity</h2>
        </div>
        <div className="flex flex-wrap items-start md:items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <input
              placeholder="Search request #, purpose, requester..."
              value={searchLocal}
              onChange={e => setSearchLocal(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white/80 focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm"
              autoComplete="off"
            />
          </div>

          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white/80 text-sm">
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

          <select value={spendingFilter} onChange={e => setSpendingFilter(e.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white/80 text-sm">
            <option value="">All spending</option>
            <option value="overspent">Overspent</option>
            <option value="underspent">Underspent</option>
            <option value="exact">Exact</option>
          </select>

          <select value={currencyFilter} onChange={e => setCurrencyFilter(e.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white/80 text-sm">
            <option value="">All currencies</option>
            {currencies.filter(c => c.is_active).map(c => (
              <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
            ))}
          </select>

          <select value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white/80 text-sm">
            <option value="">All departments</option>
            {departmentList.map(d => (
              <option key={d.id} value={d.name}>{d.name}</option>
            ))}
          </select>

          <label className="text-xs text-slate-500 flex flex-col">
            <span className="text-[11px] text-slate-400 mb-0.5">From</span>
            <DatePicker
              selected={startDateObj}
              onChange={handleStartDateChange}
              minDate={minDateLimit}
              maxDate={todayDate}
              dateFormat="yyyy-MM-dd"
              placeholderText="Start date"
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white/80 text-sm w-36"
              portalId="datepicker-portal"
              isClearable
            />
          </label>

          <label className="text-xs text-slate-500 flex flex-col">
            <span className="text-[11px] text-slate-400 mb-0.5">To</span>
            <DatePicker
              selected={endDateObj}
              onChange={handleEndDateChange}
              minDate={startDateObj || minDateLimit}
              maxDate={todayDate}
              dateFormat="yyyy-MM-dd"
              placeholderText="End date"
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white/80 text-sm w-36"
              portalId="datepicker-portal"
              isClearable
            />
          </label>

          {canSeeAll && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={viewModeAll} onChange={e => setViewModeAll(e.target.checked)} className="rounded" />
              View all IOUs
            </label>
          )}

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={showApprovedByMe} onChange={e => setShowApprovedByMe(e.target.checked)} className="rounded" />
            Approved by me
          </label>

          {/* Export button */}
          {canExport && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-700 text-white text-sm font-medium hover:from-blue-600 hover:to-blue-800 transition-all disabled:opacity-50 shadow-sm hover:shadow-md"
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

          <button
            onClick={() => { setSearchLocal(''); setStatusFilter(''); setStartDate(''); setEndDate(''); setShowApprovedByMe(false); setSpendingFilter(''); setCurrencyFilter(''); setDepartmentFilter(''); }}
            className="px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:text-slate-800 hover:bg-white/50 transition-all"
          >
            Reset
          </button>
        </div>
      </section>

      {/* Export message */}
      {exportMsg && (
        <div className={`text-sm p-3 rounded-xl border ${exportMsg.toLowerCase().includes('success') ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : exportMsg.toLowerCase().includes('failed') || exportMsg.toLowerCase().includes('error') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
          {exportMsg}
          <button onClick={() => setExportMsg('')} className="ml-3 text-xs underline opacity-60">dismiss</button>
        </div>
      )}

      {/* === Main Content Grid === */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left column */}
        <div className="space-y-5">
          {/* Quick Actions */}
          <div className="rounded-2xl bg-white/60 backdrop-blur-md border border-white/40 shadow-lg p-5">
            <div className="text-sm font-bold text-slate-700 mb-3">Quick Actions</div>
            <div className="flex flex-wrap gap-3">
              <Link to="/ious/create" className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-700 text-white text-sm font-semibold shadow-sm hover:shadow-md transition-all">
                + Request IOU
              </Link>
              <Link to="/approvals" className="px-5 py-2.5 rounded-xl bg-white border border-amber-200 text-amber-700 text-sm font-semibold hover:bg-amber-50 transition-all">
                My Approvals
              </Link>
              <Link to="/ious" className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-all">
                All Requests
              </Link>
            </div>
          </div>

          {/* Recent Requests Table */}
          <div className="rounded-2xl bg-white/60 backdrop-blur-md border border-white/40 shadow-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-bold text-slate-700">Recent Requests</div>
              <Link to="/ious" className="text-xs font-medium text-emerald-600 hover:underline">See all &rarr;</Link>
            </div>
            {filteredIousLocal.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <div className="w-12 h-12 mx-auto mb-2 text-slate-300 flex items-center justify-center">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                  </svg>
                </div>
                <div className="text-sm">No IOUs found with the current filters.</div>
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-slate-500 text-xs uppercase border-b border-slate-100">
                      <th className="text-left py-2.5 font-medium">Request</th>
                      <th className="text-left py-2.5 font-medium">Requester</th>
                      <th className="text-left py-2.5 font-medium">Amount</th>
                      <th className="text-left py-2.5 font-medium">Status</th>
                      <th className="text-left py-2.5 font-medium">Spending</th>
                      <th className="text-right py-2.5 font-medium">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIousLocal.map(i => {
                      const recon = i.reconciliation;
                      const expense = (i.expenses && i.expenses.length > 0) ? i.expenses[0] : null;
                      let spendingLabel = null;
                      let spendingClass = '';
                      if (recon && recon.diff_amount !== undefined && recon.diff_amount !== null) {
                        const diff = Number(recon.diff_amount);
                        if (diff > 0) { spendingLabel = 'Overspent'; spendingClass = 'bg-red-100 text-red-700'; }
                        else if (diff < 0) { spendingLabel = 'Underspent'; spendingClass = 'bg-amber-100 text-amber-700'; }
                        else { spendingLabel = 'Exact'; spendingClass = 'bg-emerald-100 text-emerald-700'; }
                      } else if (expense && expense.actual_amount && i.estimated_amount) {
                        const diff = Number(expense.actual_amount) - Number(i.estimated_amount);
                        if (diff > 0) { spendingLabel = 'Overspent'; spendingClass = 'bg-red-100 text-red-700'; }
                        else if (diff < 0) { spendingLabel = 'Underspent'; spendingClass = 'bg-amber-100 text-amber-700'; }
                        else { spendingLabel = 'Exact'; spendingClass = 'bg-emerald-100 text-emerald-700'; }
                      }
                      return (
                        <tr key={i.id} className="border-t border-slate-50 hover:bg-white/40 transition-colors">
                          <td className="py-3">
                            <Link to={`/ious/${i.id}`} className="font-semibold text-slate-800 hover:text-emerald-600 transition-colors">{i.request_number}</Link>
                            <div className="text-xs text-slate-400 line-clamp-1">{i.purpose}</div>
                          </td>
                          <td className="py-3 text-slate-600">{ (i.requester && i.requester.display_name) || i.requester_name || i.requester_id }</td>
                          <td className="py-3 font-medium text-slate-700">{ formatCurrency(i.estimated_amount, i.currency) }</td>
                          <td className="py-3"><StatusBadge status={i.status} /></td>
                          <td className="py-3">
                            {spendingLabel ? (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${spendingClass}`}>{spendingLabel}</span>
                            ) : (
                              <span className="text-xs text-slate-300">-</span>
                            )}
                          </td>
                          <td className="py-3 text-right text-xs text-slate-400">{ shortDate(i.created_at || i.submitted_at || i.updated_at) }</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Pending Approvals */}
          <div className="rounded-2xl bg-white/60 backdrop-blur-md border border-white/40 shadow-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-bold text-slate-700">Pending Approvals</div>
              <Link to="/approvals" className="text-xs font-medium text-emerald-600 hover:underline">View all</Link>
            </div>
            {approvals.length === 0 ? (
              <div className="text-center py-6 text-slate-400">
                <div className="w-10 h-10 mx-auto mb-1 text-emerald-500 flex items-center justify-center">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <div className="text-sm">No pending approvals</div>
              </div>
            ) :
              approvals.slice(0,6).map(a => (
                <div key={a.id} className="flex items-start justify-between p-3 rounded-xl border border-slate-100 bg-white/50 mb-2 hover:bg-white/70 transition-colors">
                  <div>
                    <div className="font-medium text-sm">IOU: <Link to={`/ious/${a.iou_id}`} className="text-emerald-600 hover:underline font-semibold">{a.iou?.request_number || a.iou_id}</Link></div>
                    <div className="text-xs text-slate-400 mt-0.5">Step {a.step_order} &bull; {shortDate(a.created_at)}</div>
                  </div>
                  <button onClick={() => nav(`/ious/${a.iou_id}`)} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-colors shadow-sm">
                    Review
                  </button>
                </div>
              ))
            }
          </div>

          {/* Activity Feed */}
          <div className="rounded-2xl bg-white/60 backdrop-blur-md border border-white/40 shadow-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-bold text-slate-700">Recent Activity</div>
              <Link to="/notifications" className="text-xs font-medium text-emerald-600 hover:underline">See all</Link>
            </div>
            {notifications.length === 0 ? (
              <div className="text-center py-6 text-slate-400">
                <div className="w-10 h-10 mx-auto mb-1 text-slate-300 flex items-center justify-center">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </div>
                <div className="text-sm">No recent activity</div>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.slice(0,6).map(n => (
                  <div key={n.id} className="flex justify-between items-start gap-3 p-2 rounded-lg hover:bg-white/40 transition-colors">
                    <div className="flex gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-slate-700">{n.title}</div>
                        <div className="text-xs text-slate-400">{n.body}</div>
                      </div>
                    </div>
                    <div className="text-xs text-slate-300 whitespace-nowrap">{ shortDate(n.created_at) }</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
