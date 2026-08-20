// src/pages/Dashboard.jsx
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import Card from '../components/ui/Card';
import { AuthContext } from '../contexts/AuthContext';

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

function shortDate(dt) {
  if (!dt) return '-';
  const d = new Date(dt);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
  const [viewModeAll, setViewModeAll] = useState(false); // admin toggle
  const [showApprovedByMe, setShowApprovedByMe] = useState(false);

  const debounceRef = useRef(null);
  const reloadIntervalRef = useRef(null);

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
  }, [startDate, endDate, statusFilter, viewModeAll, showApprovedByMe]);

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
          search: query || undefined
        };

        if (user?.is_admin && viewModeAll) params.all = true;
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
  }, [user, statusFilter, query, startDate, endDate, viewModeAll, showApprovedByMe]);

  // KPIs computed off the current (server) ious
  const kpis = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    let pendingCount = 0;
    let approvedThisMonth = 0;
    let approvedAmount = 0;
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
          if (d.getMonth() === month && d.getFullYear() === year) disbursedCount++;
        }
      }
      if (['APPROVED', 'APPROVED_FOR_DISBURSEMENT', 'DISBURSED', 'DISBURSEMENT_CONFIRMED', 'EXPENSE_PENDING_APPROVAL', 'EXPENSE_SUBMITTED', 'EXPENSE_RETURNED', 'RECONCILED', 'REDEEMED'].includes(i.status)) {
        const created = i.updated_at || i.created_at || i.submitted_at;
        if (created) {
          const d = new Date(created);
          if (d.getMonth() === month && d.getFullYear() === year) {
            approvedThisMonth++;
            if (i.estimated_amount) approvedAmount += Number(i.estimated_amount) || 0;
          }
          const diff = Math.floor((today0 - (new Date(created)).setHours(0, 0, 0, 0)) / dayMs);
          if (diff >= 0 && diff < 7) {
            perDay[6 - diff] += 1;
          }
        }
      }
    }

    return { pendingCount, approvedThisMonth, approvedAmount, disbursedCount, awaitingDisbursement, expenseSubmittedCount, sparkData: perDay };
  }, [ious]);

  // while loading show skeleton but don't disrupt searchLocal focus
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[0, 1, 2].map(i => (
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

      {/* KPIs responsive */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-400">Approved (this month)</div>
              <div className="text-3xl font-bold text-sky-700">{kpis.approvedThisMonth}</div>
              <div className="text-xs text-slate-500 mt-1">Approvals completed this month</div>
            </div>
            <div>
              <Donut value={kpis.approvedThisMonth} total={Math.max(1, ious.length || 1)} />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-400">Approved Amount</div>
              <div className="text-2xl font-bold text-indigo-700">{formatCurrency(kpis.approvedAmount)}</div>
              <div className="text-xs text-slate-500 mt-1">Value of approved IOUs this month</div>
            </div>
            <div className="p-2">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" className="text-indigo-600">
                <path d="M12 8v8m0 0l3-3m-3 3l-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1" opacity="0.12" />
              </svg>
            </div>
          </div>
        </Card>
      </section>

      {/* Filters bar */}
      <div className="flex flex-wrap items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
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

          <button onClick={() => { setSearchLocal(''); setStatusFilter(''); setStartDate(''); setEndDate(''); }} className="px-3 py-2 rounded border hidden md:inline">Reset</button>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <label className="text-xs text-slate-500 flex flex-col">
            <span className="text-[11px] text-slate-400">From</span>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="px-3 py-2 rounded border" />
          </label>

          <label className="text-xs text-slate-500 flex flex-col">
            <span className="text-[11px] text-slate-400">To</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="px-3 py-2 rounded border" />
          </label>

          {user?.is_admin && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={viewModeAll} onChange={e => setViewModeAll(e.target.checked)} />
              View all IOUs
            </label>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showApprovedByMe} onChange={e => setShowApprovedByMe(e.target.checked)} />
            Show IOUs I've approved
          </label>
        </div>
      </div>

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
                      <th className="text-right py-2">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIousLocal.map(i => (
                      <tr key={i.id} className="border-t hover:bg-slate-50">
                        <td className="py-3">
                          <Link to={`/ious/${i.id}`} className="font-medium text-slate-800 underline">{i.request_number}</Link>
                          <div className="text-xs text-slate-500 line-clamp-2">{i.purpose}</div>
                        </td>
                        <td className="py-3">{ (i.requester && i.requester.display_name) || i.requester_name || i.requester_id }</td>
                        <td className="py-3">{ formatCurrency(i.estimated_amount, i.currency) }</td>
                        <td className="py-3"><StatusBadge status={i.status} /></td>
                        <td className="py-3 text-right text-xs text-slate-500">{ shortDate(i.created_at || i.submitted_at || i.updated_at) }</td>
                      </tr>
                    ))}
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
