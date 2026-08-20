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

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-slate-800">Audit Logs</h2>

      <Card>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-slate-500 mb-1 block">Search / IFS Voucher #</label>
            <input placeholder="Search by IFS voucher #, request #, actor..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm" />
          </div>
          <div className="min-w-[150px]">
            <label className="text-xs text-slate-500 mb-1 block">Action</label>
            <input placeholder="Filter by action..." value={action} onChange={e => { setAction(e.target.value); setPage(0); }}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">From</label>
            <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(0); }} className="px-3 py-2 rounded-lg border border-slate-200 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">To</label>
            <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(0); }} className="px-3 py-2 rounded-lg border border-slate-200 text-sm" />
          </div>
          <button onClick={() => { setSearch(''); setAction(''); setStartDate(''); setEndDate(''); setPage(0); }} className="px-3 py-2 text-sm text-slate-500 hover:text-slate-800">Reset</button>
        </div>
      </Card>

      <Card>
        {loading ? (
          <div className="space-y-3">{[0, 1, 2, 3, 4].map(i => <div key={i} className="h-10 bg-slate-50 rounded animate-pulse" />)}</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-slate-500">No audit logs found</div>
        ) : (
          <>
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-slate-500 text-xs uppercase">
                    <th className="text-left py-3 px-2">Action</th>
                    <th className="text-left py-3 px-2">Actor</th>
                    <th className="text-left py-3 px-2">Entity</th>
                    <th className="text-left py-3 px-2">Entity ID</th>
                    <th className="text-right py-3 px-2">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(l => (
                    <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-2">
                        <span className="px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium">{l.action}</span>
                      </td>
                      <td className="py-3 px-2 text-slate-700">{l.actor?.display_name || l.actor_name || '-'}</td>
                      <td className="py-3 px-2 text-slate-600">{l.entity || '-'}</td>
                      <td className="py-3 px-2">{entityLink(l)}</td>
                      <td className="py-3 px-2 text-right text-slate-500 text-xs">{shortDate(l.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <span className="text-xs text-slate-500">Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}</span>
                <div className="flex gap-2">
                  <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                    className="px-3 py-1 rounded border border-slate-200 text-sm disabled:opacity-40">← Prev</button>
                  <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                    className="px-3 py-1 rounded border border-slate-200 text-sm disabled:opacity-40">Next →</button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
