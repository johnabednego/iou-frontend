import React, { useEffect, useState } from 'react';
import { getAuditLogs } from '../services/iouService';
import Card from '../components/ui/Card';
import { Link } from 'react-router-dom';

function shortDate(dt) {
  if (!dt) return '-';
  return new Date(dt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(0);
  const limit = 30;

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLogs();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, action, startDate, endDate, page]);

  async function fetchLogs() {
    setLoading(true);
    try {
      const params = { limit, offset: page * limit };
      if (search) params.search = search;
      if (action) params.action = action;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      const r = await getAuditLogs(params);
      setLogs(r.data.data || []);
      setTotal(r.data.total || 0);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  const totalPages = Math.ceil(total / limit);

  function entityLink(log) {
    if (log.entity === 'IOU' && log.entity_id) return <Link to={`/ious/${log.entity_id}`} className="text-emerald-600 hover:underline">{log.entity_id.slice(0, 8)}...</Link>;
    return <span className="text-slate-500">{log.entity_id ? log.entity_id.slice(0, 8) + '...' : '-'}</span>;
  }

  const uniqueActions = new Set(logs.map(l => l.action).filter(Boolean)).size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">System Audit Logs</h1>
        <p className="text-sm text-slate-500 mt-1">
          Complete, tamper-evident trail of all IOU requests, approval decisions, disbursements, and administrative changes.
        </p>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 p-5 shadow-lg text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">Total Recorded Events</span>
            <div className="p-1.5 rounded-lg bg-white/10">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </div>
          </div>
          <div className="text-3xl font-extrabold">{total}</div>
          <div className="text-xs text-slate-400 mt-1">System-wide audit trail</div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-700 p-5 shadow-lg text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-indigo-100 uppercase tracking-wider">Current View</span>
            <div className="p-1.5 rounded-lg bg-white/15">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            </div>
          </div>
          <div className="text-3xl font-extrabold">{logs.length}</div>
          <div className="text-xs text-indigo-100 mt-1">Logs on page {page + 1} of {Math.max(1, totalPages)}</div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 p-5 shadow-lg text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-emerald-100 uppercase tracking-wider">Distinct Actions</span>
            <div className="p-1.5 rounded-lg bg-white/15">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
            </div>
          </div>
          <div className="text-3xl font-extrabold">{uniqueActions}</div>
          <div className="text-xs text-emerald-100 mt-1">Operation types detected</div>
        </div>
      </div>

      {/* Filter Card */}
      <Card>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[220px] relative">
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Search / IFS Voucher / Actor</label>
            <div className="relative">
              <input
                placeholder="Search IFS voucher, request #, actor..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0); }}
                className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
              />
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" strokeWidth="2" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2" />
              </svg>
            </div>
          </div>

          <div className="min-w-[160px]">
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Action Type</label>
            <input
              placeholder="e.g. APPROVE, CREATE..."
              value={action}
              onChange={e => { setAction(e.target.value); setPage(0); }}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">From</label>
            <input
              type="date"
              value={startDate}
              onChange={e => { setStartDate(e.target.value); setPage(0); }}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">To</label>
            <input
              type="date"
              value={endDate}
              onChange={e => { setEndDate(e.target.value); setPage(0); }}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
            />
          </div>

          {(search || action || startDate || endDate) && (
            <button
              onClick={() => { setSearch(''); setAction(''); setStartDate(''); setEndDate(''); setPage(0); }}
              className="px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
            >
              Reset
            </button>
          )}
        </div>
      </Card>

      {/* Logs Table */}
      <Card>
        {loading ? (
          <div className="space-y-3 py-4">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="h-12 bg-slate-50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <div className="w-12 h-12 mx-auto mb-3 text-slate-300 flex items-center justify-center">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
            <p className="text-base font-semibold text-slate-600">No audit logs found</p>
            <p className="text-sm mt-1">Try adjusting your filters or date range.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-3">Action</th>
                    <th className="py-3 px-3">Actor</th>
                    <th className="py-3 px-3">Entity</th>
                    <th className="py-3 px-3">Entity ID</th>
                    <th className="py-3 px-3 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {logs.map(l => (
                    <tr key={l.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-3">
                        <span className="inline-block px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-100">
                          {l.action}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-800">
                        {l.actor?.display_name || l.actor_name || '-'}
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-medium">{l.entity || '-'}</td>
                      <td className="py-3 px-3">{entityLink(l)}</td>
                      <td className="py-3 px-3 text-right text-slate-500 text-xs">{shortDate(l.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                <span className="text-xs text-slate-500">
                  Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={page === 0}
                    onClick={() => setPage(p => p - 1)}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40 transition-colors"
                  >
                    ← Prev
                  </button>
                  <button
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage(p => p + 1)}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40 transition-colors"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
