// src/pages/FundManagement.jsx
import React, { useState, useEffect, useContext } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import ConfirmModal from '../components/ui/ConfirmModal';
import { AuthContext } from '../contexts/AuthContext';
import {
  getFundBalances, updateFundBalance, getFundTransactions,
  getCurrencies, addCurrency, deleteCurrency
} from '../services/iouService';

const CURRENCY_COLORS = { GHS: '#065f46', USD: '#1d4ed8', EUR: '#7c3aed', GBP: '#be185d' };

function formatCurrency(n, currency = 'GHS') {
  if (n == null) return `${currency} 0.00`;
  const localeMap = { GHS: 'en-GH', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB' };
  return new Intl.NumberFormat(localeMap[currency] || 'en-US', { style: 'currency', currency }).format(n);
}

const TX_TYPE_BADGES = {
  MANUAL_SET: { label: 'Set', cls: 'bg-blue-100 text-blue-700' },
  MANUAL_CREDIT: { label: 'Credit', cls: 'bg-emerald-100 text-emerald-700' },
  MANUAL_DEBIT: { label: 'Debit', cls: 'bg-orange-100 text-orange-700' },
  DISBURSEMENT_DEBIT: { label: 'Disbursement', cls: 'bg-red-100 text-red-700' },
  RECONCILIATION_ADJUSTMENT: { label: 'Reconciliation', cls: 'bg-purple-100 text-purple-700' }
};

export default function FundManagement() {
  const { user } = useContext(AuthContext);
  const isCashierOrAdmin = user?.is_admin || user?.role === 'cashier';

  const [balances, setBalances] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [txTotal, setTxTotal] = useState(0);
  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Update form
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [action, setAction] = useState('increase');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [updating, setUpdating] = useState(false);

  // Add currency form
  const [newCurCode, setNewCurCode] = useState('');
  const [newCurName, setNewCurName] = useState('');
  const [newCurSymbol, setNewCurSymbol] = useState('');
  const [addingCurrency, setAddingCurrency] = useState(false);

  // Tx filter
  const [txCurrencyFilter, setTxCurrencyFilter] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState('');

  // Deactivation confirmation modal state
  const [deactivateModal, setDeactivateModal] = useState({ open: false, currency: null });

  async function loadData() {
    try {
      setLoading(true);
      const [bRes, tRes, cRes] = await Promise.all([
        getFundBalances(),
        getFundTransactions({ currency: txCurrencyFilter || undefined, type: txTypeFilter || undefined, limit: 50 }),
        getCurrencies({ include_inactive: 'true' })
      ]);
      setBalances(bRes.data?.data || []);
      setTransactions(tRes.data?.data || []);
      setTxTotal(tRes.data?.total || 0);
      setCurrencies(cRes.data?.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load fund data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [txCurrencyFilter, txTypeFilter]);

  async function handleUpdateBalance(e) {
    e.preventDefault();
    if (!selectedCurrency || !amount || Number(amount) < 0) {
      setError('Please select a currency and enter a valid amount');
      return;
    }
    setUpdating(true);
    setError('');
    setSuccess('');
    try {
      const res = await updateFundBalance(selectedCurrency, { action, amount: Number(amount), notes });
      setSuccess(`${selectedCurrency} balance updated: ${res.data?.balance?.previous_amount} → ${res.data?.balance?.new_amount}`);
      setAmount('');
      setNotes('');
      loadData();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to update balance');
    } finally {
      setUpdating(false);
    }
  }

  async function handleAddCurrency(e) {
    e.preventDefault();
    if (!newCurCode.trim() || !newCurName.trim()) {
      setError('Currency code and name are required');
      return;
    }
    setAddingCurrency(true);
    setError('');
    setSuccess('');
    try {
      await addCurrency({ code: newCurCode.trim(), name: newCurName.trim(), symbol: newCurSymbol.trim() || null });
      setSuccess(`Currency ${newCurCode.trim().toUpperCase()} added successfully`);
      setNewCurCode('');
      setNewCurName('');
      setNewCurSymbol('');
      loadData();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to add currency');
    } finally {
      setAddingCurrency(false);
    }
  }

  function handleDeleteCurrency(cur) {
    setDeactivateModal({
      open: true,
      currency: cur
    });
  }

  async function confirmDeleteCurrency() {
    const cur = deactivateModal.currency;
    setDeactivateModal({ open: false, currency: null });
    if (!cur) return;
    setError('');
    setSuccess('');
    try {
      const res = await deleteCurrency(cur.id);
      setSuccess(res.data?.message || `Currency ${cur.code} removed`);
      loadData();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to remove currency');
    }
  }

  if (!isCashierOrAdmin) {
    return (
      <div className="max-w-2xl mx-auto mt-10">
        <Card>
          <div className="text-center py-8">
            <div className="text-4xl mb-3">🔒</div>
            <div className="text-lg font-semibold text-slate-700">Access Restricted</div>
            <div className="text-sm text-slate-500 mt-1">Only cashiers and administrators can manage fund balances.</div>
          </div>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {[0, 1, 2].map(i => <div key={i} className="h-32 bg-white/80 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">💰 Fund Management</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-3 text-xs underline opacity-60">dismiss</button>
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-lg text-sm">
          {success}
          <button onClick={() => setSuccess('')} className="ml-3 text-xs underline opacity-60">dismiss</button>
        </div>
      )}

      {/* Balance Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {balances.map(fb => {
          const amt = Number(fb.available_amount) || 0;
          const color = CURRENCY_COLORS[fb.currency] || '#6366f1';
          const isLow = amt < 1000;
          const isNeg = amt < 0;
          return (
            <div
              key={fb.currency}
              className="relative overflow-hidden rounded-xl border p-5 transition-all shadow-md"
              style={{ borderLeftWidth: 4, borderLeftColor: color }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: color + '18', color }}>
                  {fb.currency}
                </span>
                {isNeg && <span className="text-xs font-medium text-red-500 bg-red-50 px-1.5 py-0.5 rounded">Deficit</span>}
                {!isNeg && isLow && <span className="text-xs font-medium text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded">Low</span>}
              </div>
              <div className={`text-2xl font-bold ${isNeg ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-slate-800'}`}>
                {formatCurrency(amt, fb.currency)}
              </div>
              {fb.updatedBy && (
                <div className="text-xs text-slate-400 mt-1">
                  Last updated by {fb.updatedBy.display_name || fb.updatedBy.username}
                </div>
              )}
              {/* Background decoration */}
              <div className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full opacity-5" style={{ backgroundColor: color }} />
            </div>
          );
        })}
        {balances.length === 0 && (
          <div className="col-span-4 text-center text-slate-400 py-4">No fund balances configured</div>
        )}
      </section>

      {/* Update Balance Form */}
      <Card>
        <div className="text-sm font-semibold text-slate-600 mb-4">Update Fund Balance</div>
        <form onSubmit={handleUpdateBalance} className="grid grid-cols-1 sm:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Currency</label>
            <select
              value={selectedCurrency}
              onChange={e => setSelectedCurrency(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
              required
            >
              <option value="">Select...</option>
              {balances.map(b => <option key={b.currency} value={b.currency}>{b.currency}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Action</label>
            <select
              value={action}
              onChange={e => setAction(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
            >
              <option value="increase">Increase</option>
              <option value="decrease">Decrease</option>
              <option value="set">Set to</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Amount</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Reason..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
            />
          </div>
          <div>
            <Button type="submit" disabled={updating}>
              {updating ? 'Updating...' : 'Update Balance'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Currency Management */}
      <Card>
        <div className="text-sm font-semibold text-slate-600 mb-4">Currency Management</div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Add new currency */}
          <div>
            <div className="text-xs text-slate-500 mb-2 font-medium">Add New Currency</div>
            <form onSubmit={handleAddCurrency} className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Code</label>
                <input
                  value={newCurCode}
                  onChange={e => setNewCurCode(e.target.value.toUpperCase())}
                  placeholder="JPY"
                  maxLength={8}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm w-20"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Name</label>
                <input
                  value={newCurName}
                  onChange={e => setNewCurName(e.target.value)}
                  placeholder="Japanese Yen"
                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm w-40"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Symbol</label>
                <input
                  value={newCurSymbol}
                  onChange={e => setNewCurSymbol(e.target.value)}
                  placeholder="¥"
                  maxLength={8}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm w-16"
                />
              </div>
              <Button type="submit" disabled={addingCurrency} variant="secondary">
                {addingCurrency ? 'Adding...' : 'Add'}
              </Button>
            </form>
          </div>

          {/* Existing currencies */}
          <div>
            <div className="text-xs text-slate-500 mb-2 font-medium">Active Currencies</div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {currencies.map(cur => (
                <div key={cur.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-bold px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: (CURRENCY_COLORS[cur.code] || '#6366f1') + '18', color: CURRENCY_COLORS[cur.code] || '#6366f1' }}
                    >
                      {cur.code}
                    </span>
                    <span className="text-sm text-slate-700">{cur.name}</span>
                    {cur.symbol && <span className="text-xs text-slate-400">({cur.symbol})</span>}
                    {!cur.is_active && <span className="text-xs text-red-500 bg-red-50 px-1 py-0.5 rounded">Inactive</span>}
                  </div>
                  <button
                    onClick={() => handleDeleteCurrency(cur)}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors"
                    title={cur.is_active ? 'Deactivate' : 'Delete permanently'}
                  >
                    {cur.is_active ? 'Deactivate' : 'Delete'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Transaction History */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold text-slate-600">Transaction History</div>
          <div className="flex items-center gap-2">
            <select
              value={txCurrencyFilter}
              onChange={e => setTxCurrencyFilter(e.target.value)}
              className="px-2 py-1 rounded border text-xs"
            >
              <option value="">All currencies</option>
              {balances.map(b => <option key={b.currency} value={b.currency}>{b.currency}</option>)}
            </select>
            <select
              value={txTypeFilter}
              onChange={e => setTxTypeFilter(e.target.value)}
              className="px-2 py-1 rounded border text-xs"
            >
              <option value="">All types</option>
              <option value="MANUAL_SET">Set</option>
              <option value="MANUAL_CREDIT">Credit</option>
              <option value="MANUAL_DEBIT">Debit</option>
              <option value="DISBURSEMENT_DEBIT">Disbursement</option>
              <option value="RECONCILIATION_ADJUSTMENT">Reconciliation</option>
            </select>
          </div>
        </div>

        {transactions.length === 0 ? (
          <div className="text-center text-slate-400 py-6 text-sm">No transactions found</div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left py-2">Date</th>
                  <th className="text-left py-2">Currency</th>
                  <th className="text-left py-2">Type</th>
                  <th className="text-right py-2">Amount</th>
                  <th className="text-right py-2">Balance After</th>
                  <th className="text-left py-2">By</th>
                  <th className="text-left py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(tx => {
                  const badge = TX_TYPE_BADGES[tx.type] || { label: tx.type, cls: 'bg-slate-100 text-slate-600' };
                  const isDebit = tx.type.includes('DEBIT') || tx.type === 'MANUAL_SET';
                  return (
                    <tr key={tx.id} className="border-t hover:bg-slate-50">
                      <td className="py-2 text-xs text-slate-500">
                        {new Date(tx.created_at).toLocaleDateString()} {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2">
                        <span className="text-xs font-semibold" style={{ color: CURRENCY_COLORS[tx.currency] || '#6366f1' }}>
                          {tx.currency}
                        </span>
                      </td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>{badge.label}</span>
                      </td>
                      <td className={`py-2 text-right font-medium ${isDebit ? 'text-red-600' : 'text-emerald-600'}`}>
                        {isDebit ? '-' : '+'}{formatCurrency(tx.amount, tx.currency)}
                      </td>
                      <td className="py-2 text-right font-medium text-slate-700">
                        {formatCurrency(tx.balance_after, tx.currency)}
                      </td>
                      <td className="py-2 text-xs text-slate-500">
                        {tx.performer?.display_name || tx.performer?.username || '-'}
                      </td>
                      <td className="py-2 text-xs text-slate-400 max-w-[200px] truncate" title={tx.notes}>
                        {tx.notes || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {txTotal > transactions.length && (
              <div className="text-center text-xs text-slate-400 mt-2">
                Showing {transactions.length} of {txTotal} transactions
              </div>
            )}
          </div>
        )}
      </Card>
      <ConfirmModal
        open={deactivateModal.open}
        onClose={() => setDeactivateModal({ open: false, currency: null })}
        onConfirm={confirmDeleteCurrency}
        title={deactivateModal.currency?.is_active ? 'Deactivate Currency' : 'Remove Currency'}
        message={
          deactivateModal.currency
            ? deactivateModal.currency.is_active
              ? <>Are you sure you want to deactivate <strong>{deactivateModal.currency.code}</strong>? The fund balance must be <strong>0.00</strong> to proceed. If there is any remaining balance, you will need to decrease it to zero first.</>
              : <>Are you sure you want to permanently remove <strong>{deactivateModal.currency.code}</strong>? This cannot be undone if there are no transactions tied to it.</>
            : ''
        }
        confirmText={deactivateModal.currency?.is_active ? 'Deactivate' : 'Remove'}
        variant="danger"
      />
    </div>
  );
}
