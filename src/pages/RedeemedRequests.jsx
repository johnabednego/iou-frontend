import React, { useContext, useEffect, useMemo, useState } from 'react';
import { listIOUs, exportIOUs, getDateLimit, getCurrencies } from '../services/iouService';
import Card from '../components/ui/Card';
import { Link } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

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
  const { user } = useContext(AuthContext);
  const [ious, setIous] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [spendingFilter, setSpendingFilter] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('');
  const [currencies, setCurrencies] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState('');
  const [minDateLimit, setMinDateLimit] = useState(null);
  const todayDate = new Date();
  todayDate.setHours(23, 59, 59, 999);

  // Check export permission: cashier, admin, or approver
  const canExport = user?.is_admin || user?.role === 'cashier' || user?.is_approver === true;

  // Fetch admin date limit on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await getDateLimit();
        if (res.data?.min_date) {
          setMinDateLimit(new Date(res.data.min_date));
        }
      } catch (_) {
        const now = new Date();
        setMinDateLimit(new Date(now.getFullYear(), now.getMonth(), 1));
      }
    })();
  }, []);

  // Load currencies
  useEffect(() => {
    getCurrencies({ include_inactive: 'true' }).then(res => setCurrencies(res.data?.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRedeemedIOUs();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, startDate, endDate, spendingFilter, currencyFilter]);

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
      if (spendingFilter) params.spending = spendingFilter;
      if (currencyFilter) params.currency = currencyFilter;

      const res = await listIOUs(params);
      setIous(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch redeemed requests', err);
    } finally {
      setLoading(false);
    }
  }

  // Export handler
  async function handleExport() {
    setExportMsg('');
    if (ious.length === 0) {
      setExportMsg('ℹ️ There are no redeemed IOUs matching the current filters to export.');
      return;
    }
    setExporting(true);
    try {
      const params = { status: 'REDEEMED', all: true };
      if (search.trim()) params.search = search.trim();
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (spendingFilter) params.spending = spendingFilter;
      if (currencyFilter) params.currency = currencyFilter;

      const res = await exportIOUs(params);
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().slice(0, 10);
      a.download = `redeemed_ious_${timestamp}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setExportMsg('✅ Export downloaded successfully.');
    } catch (err) {
      console.error('Export error', err);
      let msg = err?.response?.data?.message || 'Export failed. Please try again.';
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

  const totalCount = ious.length;
  const withVoucherCount = ious.filter(i => i.ifs_voucher_number).length;

  // Multi-currency overall redeemed volume calculation
  const redeemedAmountByCurrency = useMemo(() => {
    const map = {};
    for (const iou of ious) {
      const cur = (iou.currency || 'GHS').toUpperCase().trim();
      const amt = Number(iou.estimated_amount) || 0;
      map[cur] = (map[cur] || 0) + amt;
    }
    return map;
  }, [ious]);

  const currencyEntries = useMemo(() => {
    const codeSet = new Set();
    if (currencies && currencies.length > 0) {
      currencies.forEach(c => codeSet.add(c.code));
    } else {
      ['GHS', 'USD', 'EUR', 'GBP'].forEach(c => codeSet.add(c));
    }
    if (redeemedAmountByCurrency) {
      Object.keys(redeemedAmountByCurrency).forEach(c => codeSet.add(c));
    }

    const order = ['GHS', 'USD', 'EUR', 'GBP'];
    const entries = [];

    for (const code of codeSet) {
      const currObj = currencies.find(c => c.code === code);
      const isActive = currObj ? !!currObj.is_active : (currencies.length === 0);
      const amt = (redeemedAmountByCurrency || {})[code] || 0;

      // Rule: if deactivated and redeemed amount is 0, hide it
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
  }, [currencies, redeemedAmountByCurrency]);

  const filteredCurrencyEntries = useMemo(() => {
    if (!currencyFilter) return currencyEntries;
    return currencyEntries.filter(([code]) => code === currencyFilter);
  }, [currencyEntries, currencyFilter]);

  const volumeLabel = useMemo(() => {
    if (startDate && endDate) return `Overall (${shortDate(startDate)} - ${shortDate(endDate)})`;
    if (startDate) return `Overall (from ${shortDate(startDate)})`;
    if (endDate) return `Overall (up to ${shortDate(endDate)})`;
    return 'Overall redeemed volume';
  }, [startDate, endDate]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Redeemed Requests</h1>
          <p className="text-sm text-slate-500 mt-1">
            All fully reconciled and redeemed IOUs with verified IFS voucher numbers and proof of settlement.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canExport && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white text-sm font-semibold hover:from-blue-700 hover:to-indigo-800 transition-all disabled:opacity-50 shadow-md hover:shadow-lg"
              title="Export redeemed IOUs to Excel"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="1" x2="12" y2="3" />
              </svg>
              {exporting ? 'Exporting...' : 'Export to Excel'}
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 p-5 shadow-lg text-white flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">Total Redeemed</span>
              <div className="p-1.5 rounded-lg bg-white/10">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
            </div>
            <div className="text-3xl font-extrabold">{totalCount}</div>
          </div>
          <div className="text-xs text-slate-400 mt-2">Fully closed & settled</div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 p-5 shadow-lg text-white flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-emerald-100 uppercase tracking-wider">With IFS Voucher #</span>
              <div className="p-1.5 rounded-lg bg-white/15">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              </div>
            </div>
            <div className="text-3xl font-extrabold">{withVoucherCount}</div>
          </div>
          <div className="text-xs text-emerald-100 mt-2">Directly linked to ERP voucher</div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-700 p-5 shadow-lg text-white flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-indigo-100 uppercase tracking-wider">Redeemed Volume</span>
              <div className="p-1.5 rounded-lg bg-white/15">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </div>
            </div>
            <div className="space-y-1.5 max-h-[85px] overflow-y-auto pr-1">
              {filteredCurrencyEntries.length === 0 ? (
                <div className="text-sm text-indigo-100/80 italic py-1">No redeemed volume</div>
              ) : (
                filteredCurrencyEntries.map(([cur, amt]) => (
                  <div key={cur} className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-indigo-200 bg-white/10 px-1.5 py-0.5 rounded">{cur}</span>
                    <span className="text-sm font-bold text-white">{formatCurrency(amt, cur)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="text-xs text-indigo-100 mt-2">{volumeLabel}</div>
        </div>
      </div>

      {/* Export message */}
      {exportMsg && (
        <div className={`text-sm p-3.5 rounded-xl border ${
          exportMsg.includes('successfully')
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : exportMsg.includes('no') || exportMsg.includes('No')
            ? 'bg-blue-50 border-blue-200 text-blue-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {exportMsg}
          <button onClick={() => setExportMsg('')} className="ml-3 text-xs underline opacity-60">dismiss</button>
        </div>
      )}

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[240px] relative">
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Search</label>
            <div className="relative">
              <input
                placeholder="Search IOU #, IFS voucher #, requester..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm bg-white"
              />
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" strokeWidth="2" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2" />
              </svg>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">From</label>
            <DatePicker
              selected={startDateObj}
              onChange={(date) => setStartDate(date ? date.toISOString().slice(0, 10) : '')}
              minDate={minDateLimit}
              maxDate={todayDate}
              dateFormat="yyyy-MM-dd"
              placeholderText="Start date"
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm w-36 bg-white"
              portalId="datepicker-portal"
              isClearable
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">To</label>
            <DatePicker
              selected={endDateObj}
              onChange={(date) => setEndDate(date ? date.toISOString().slice(0, 10) : '')}
              minDate={startDateObj || minDateLimit}
              maxDate={todayDate}
              dateFormat="yyyy-MM-dd"
              placeholderText="End date"
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm w-36 bg-white"
              portalId="datepicker-portal"
              isClearable
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Spending</label>
            <select value={spendingFilter} onChange={e => setSpendingFilter(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white">
              <option value="">All</option>
              <option value="overspent">Overspent</option>
              <option value="underspent">Underspent</option>
              <option value="exact">Exact</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Currency</label>
            <select value={currencyFilter} onChange={e => setCurrencyFilter(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white">
              <option value="">All</option>
              {currencies.filter(c => c.is_active).map(c => (
                <option key={c.code} value={c.code}>{c.code}</option>
              ))}
            </select>
          </div>

          {(search || startDate || endDate || spendingFilter || currencyFilter) && (
            <button
              onClick={() => { setSearch(''); setStartDate(''); setEndDate(''); setSpendingFilter(''); setCurrencyFilter(''); }}
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
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-slate-50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : ious.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <div className="w-12 h-12 mx-auto mb-3 text-slate-300 flex items-center justify-center">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <p className="text-base font-semibold text-slate-600">No redeemed requests found</p>
            <p className="text-sm mt-1">Try adjusting your search query or date filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-3">Request #</th>
                  <th className="py-3 px-3">IFS Voucher Number</th>
                  <th className="py-3 px-3">Requester</th>
                  <th className="py-3 px-3">Department</th>
                  <th className="py-3 px-3 text-right">Amount</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center">Spending</th>
                  <th className="py-3 px-3 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {ious.map((iou) => {
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
                    <td className="py-3 px-3 text-center">
                      {spendingLabel ? (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${spendingClass}`}>{spendingLabel}</span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-500 text-xs">
                      {shortDate(iou.updated_at || iou.created_at)}
                    </td>
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
