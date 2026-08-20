import React, { useEffect, useState } from 'react';
import { listIOUs } from '../services/iouService';
import Card from '../components/ui/Card';
import { Link } from 'react-router-dom';

function formatCurrency(n, currency = 'GHS') {
  if (n == null) return `${currency} 0.00`;
  const localeMap = { GHS: 'en-GH', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB' };
  return new Intl.NumberFormat(localeMap[currency] || 'en-US', { style: 'currency', currency }).format(n);
}

function shortDate(dt) {
  if (!dt) return '-';
  return new Date(dt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function RedeemedRequests() {
  const [ious, setIous] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRedeemedIOUs();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, startDate, endDate]);

  async function fetchRedeemedIOUs() {
    setLoading(true);
    try {
      const params = {
        status: 'REDEEMED',
        all: true,
        limit: 500
      };
      if (search) params.search = search;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const res = await listIOUs(params);
      setIous(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch redeemed requests', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Redeemed Requests</h2>
          <p className="text-sm text-slate-500">All fully reconciled and redeemed IOUs with IFS voucher numbers.</p>
        </div>
        <span className="px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-semibold">
          {ious.length} Redeemed
        </span>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[240px]">
            <label className="text-xs text-slate-500 mb-1 block font-medium">Search</label>
            <input
              placeholder="Search by IOU #, IFS voucher #, requester, or amount..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block font-medium">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block font-medium">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
            />
          </div>
          <button
            onClick={() => { setSearch(''); setStartDate(''); setEndDate(''); }}
            className="px-3 py-2 text-sm text-slate-500 hover:text-slate-800"
          >
            Reset
          </button>
        </div>
      </Card>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-slate-50 rounded animate-pulse" />
            ))}
          </div>
        ) : ious.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <div className="text-4xl mb-2">🎉</div>
            <p className="font-medium">No redeemed requests found</p>
            <p className="text-xs text-slate-400 mt-1">Try clearing your search query or filters.</p>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-slate-500 text-xs uppercase bg-slate-50/50">
                  <th className="text-left py-3 px-3">Request #</th>
                  <th className="text-left py-3 px-3">IFS Voucher Number</th>
                  <th className="text-left py-3 px-3">Requester</th>
                  <th className="text-left py-3 px-3">Department</th>
                  <th className="text-right py-3 px-3">Amount</th>
                  <th className="text-center py-3 px-3">Status</th>
                  <th className="text-right py-3 px-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {ious.map((iou) => (
                  <tr key={iou.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-3">
                      <Link to={`/ious/${iou.id}`} className="font-medium text-slate-800 hover:text-emerald-700 hover:underline">
                        {iou.request_number}
                      </Link>
                      <div className="text-xs text-slate-500 line-clamp-1 max-w-[220px]">{iou.purpose}</div>
                    </td>
                    <td className="py-3 px-3">
                      {iou.ifs_voucher_number ? (
                        <a
                          href="https://ifsprod.apmterminals.com/client/runtime/Ifs.Fnd.Explorer.application"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline inline-flex items-center gap-1 font-semibold"
                        >
                          {iou.ifs_voucher_number}
                          <svg className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      ) : (
                        <span className="text-slate-400 font-mono text-xs">N/A</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {iou.requester?.display_name || iou.requester?.username || '-'}
                    </td>
                    <td className="py-3 px-3 text-slate-600">{iou.department || '-'}</td>
                    <td className="py-3 px-3 text-right font-semibold text-slate-800">
                      {formatCurrency(iou.estimated_amount, iou.currency)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                        REDEEMED
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right text-slate-500 text-xs">
                      {shortDate(iou.updated_at || iou.created_at)}
                    </td>
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
