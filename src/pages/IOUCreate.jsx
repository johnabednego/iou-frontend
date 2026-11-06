import React, { useState, useContext, useEffect, useCallback } from 'react';
import { createIOU, createDirectExpense, checkFunds, getCurrencies } from '../services/iouService';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import FileUploader from '../components/ui/FileUploader';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';

export default function IOUCreate({ defaultTab: propDefaultTab }) {
  const [searchParams] = useSearchParams();
  const initialTab = propDefaultTab || (searchParams.get('type') === 'direct-expense' ? 'direct-expense' : 'iou');
  const [requestType, setRequestType] = useState(initialTab); // 'iou' | 'direct-expense'

  const [purpose, setPurpose] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('GHS');
  const [attachments, setAttachments] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const nav = useNavigate();
  const { user } = useContext(AuthContext);

  // Fund check state
  const [fundSufficient, setFundSufficient] = useState(true);
  const [checkingFunds, setCheckingFunds] = useState(false);

  // Dynamic currencies from DB
  const [availableCurrencies, setAvailableCurrencies] = useState([]);

  // Load currencies on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await getCurrencies();
        const active = (res.data?.data || []).filter(c => c.is_active);
        setAvailableCurrencies(active);
        if (active.length > 0 && !active.find(c => c.code === currency)) {
          setCurrency(active[0].code);
        }
      } catch (_) {
        setAvailableCurrencies([
          { code: 'GHS', name: 'Ghana Cedi' },
          { code: 'USD', name: 'US Dollar' },
          { code: 'EUR', name: 'Euro' },
          { code: 'GBP', name: 'British Pound' }
        ]);
      }
    })();
  }, []);

  // Update requestType if query param changes
  useEffect(() => {
    const qType = searchParams.get('type');
    if (qType === 'direct-expense' || qType === 'de') {
      setRequestType('direct-expense');
    } else if (qType === 'iou') {
      setRequestType('iou');
    }
  }, [searchParams]);

  // Check fund sufficiency when amount or currency changes
  useEffect(() => {
    const numAmt = Number(amount);
    if (!currency) return;

    if (amount !== '' && (isNaN(numAmt) || numAmt <= 0)) {
      setFundSufficient(false);
      return;
    }

    if (!amount) {
      setFundSufficient(true);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingFunds(true);
      try {
        const res = await checkFunds(currency, numAmt);
        setFundSufficient(res.data?.sufficient === true);
      } catch (_) {
        setFundSufficient(true); // Don't block on network error
      } finally {
        setCheckingFunds(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [amount, currency]);

  const safeAttachments = attachments.filter(
    (att) => att && typeof att === 'object' && att.file_name
  );

  function validate() {
    const e = {};
    if (!purpose.trim()) e.purpose = 'Purpose is required';
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      e.amount = 'Amount must be greater than 0.00. Requests with an amount of 0 or less are not accepted.';
    }

    // Attachments are REQUIRED for Direct Expense
    if (requestType === 'direct-expense' && safeAttachments.length === 0) {
      e.attachments = 'Receipt or invoice attachments are required for a Direct Expense.';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleCreate() {
    if (!validate()) return;

    setSubmitting(true);
    setErrors({});
    setSuccess('');

    try {
      const payloadAttachments = safeAttachments.map((a) => ({
        file_name: a.file_name,
        file_path: a.file_path,
        blob_name: a.blob_name,
        content_type: a.content_type,
        size: a.size
      }));

      if (requestType === 'direct-expense') {
        const res = await createDirectExpense({
          purpose,
          amount: Number(amount),
          currency: currency || 'GHS',
          attachments: payloadAttachments
        });
        setSuccess('Direct Expense request created successfully! Redirecting...');
        setTimeout(() => nav(`/direct-expenses/${res.data.directExpense.id}`), 800);
      } else {
        const res = await createIOU({
          purpose,
          estimated_amount: Number(amount),
          currency: currency || 'GHS',
          attachments: payloadAttachments
        });
        setSuccess('IOU request created successfully! Redirecting...');
        setTimeout(() => nav(`/ious/${res.data.iou.id}`), 800);
      }
    } catch (err) {
      console.error(err);
      setErrors({
        form: err?.response?.data?.message || `Failed to create ${requestType === 'direct-expense' ? 'Direct Expense' : 'IOU'}. Please try again.`
      });
    } finally {
      setSubmitting(false);
    }
  }

  function removeAttachment(idx) {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  const isDe = requestType === 'direct-expense';

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Type Selection Switcher */}
      <div className="bg-white rounded-2xl p-2 border border-slate-200/80 shadow-sm">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-2 pt-1">
          Select Request Type
        </label>
        <div className="grid grid-cols-2 gap-2">
          {/* IOU Tab */}
          <button
            type="button"
            onClick={() => {
              setRequestType('iou');
              setErrors({});
            }}
            className={`p-3.5 rounded-xl text-left transition-all border ${
              !isDe
                ? 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white border-blue-600 shadow-md ring-2 ring-blue-400/40'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <svg className={`w-5 h-5 ${!isDe ? 'text-white' : 'text-blue-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="font-bold text-sm">IOU Request</span>
            </div>
            <p className={`text-xs ${!isDe ? 'text-blue-100' : 'text-slate-500'}`}>
              Petty cash advance. Reconcile with receipts after spending.
            </p>
          </button>

          {/* Direct Expense Tab */}
          <button
            type="button"
            onClick={() => {
              setRequestType('direct-expense');
              setErrors({});
            }}
            className={`p-3.5 rounded-xl text-left transition-all border ${
              isDe
                ? 'bg-gradient-to-r from-teal-600 to-cyan-700 text-white border-teal-600 shadow-md ring-2 ring-teal-400/40'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <svg className={`w-5 h-5 ${isDe ? 'text-white' : 'text-teal-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="font-bold text-sm">Direct Expense</span>
            </div>
            <p className={`text-xs ${isDe ? 'text-teal-100' : 'text-slate-500'}`}>
              Direct payment / refund. Receipts required upfront.
            </p>
          </button>
        </div>
      </div>

      {/* Main Request Form */}
      <Card title={isDe ? 'New Direct Expense' : 'New IOU Request'}>
        {/* Dynamic Informational Banner */}
        <div className={`mb-5 p-3.5 rounded-xl border text-sm flex items-start gap-3 ${
          isDe
            ? 'bg-teal-50 border-teal-200 text-teal-800'
            : 'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          <div className="mt-0.5">
            {isDe ? (
              <svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
          <div>
            <p className="font-semibold">
              {isDe ? 'Direct Expense Mode Active' : 'IOU Request Mode Active'}
            </p>
            <p className="text-xs mt-0.5 opacity-90">
              {isDe
                ? 'Direct expenses are disbursed directly against verified invoices or receipts. Attachments are mandatory before submission. No post-disbursement reconciliation is required.'
                : 'IOUs provide upfront cash advances. You will be required to submit receipts and perform reconciliation once funds are spent.'}
            </p>
          </div>
        </div>

        {errors.form && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {errors.form}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
            {success}
          </div>
        )}

        <div className="space-y-5">
          <div>
            <Input
              label="Purpose *"
              placeholder={isDe ? 'e.g. Flight ticket reimbursement, emergency repair parts' : 'e.g. Office supplies procurement'}
              value={purpose}
              onChange={(e) => {
                setPurpose(e.target.value);
                setErrors((s) => ({ ...s, purpose: undefined }));
              }}
            />
            {errors.purpose && (
              <p className="text-red-500 text-xs mt-1">{errors.purpose}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <Input
                label={`Amount (${currency}) *`}
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setErrors((s) => ({ ...s, amount: undefined }));
                }}
              />
              {errors.amount && (
                <p className="text-red-500 text-xs mt-1">{errors.amount}</p>
              )}
            </div>

            <div>
              <label className="block text-sm text-slate-700 mb-1">
                Currency <span className="text-red-500">*</span>
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm bg-white"
              >
                {availableCurrencies.map(c => (
                  <option key={c.code} value={c.code}>{c.code} – {c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {user?.department && (
            <div>
              <label className="block text-sm text-slate-700 mb-1">
                Department
              </label>
              <div className="px-4 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-600">
                {user.department}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm text-slate-700">
                {isDe ? 'Receipts / Invoice Attachments' : 'Attachments'}{' '}
                {isDe && <span className="text-red-500 font-bold">* (Required)</span>}
              </label>
              {isDe && (
                <span className="text-xs text-teal-600 font-medium">Minimum 1 receipt required</span>
              )}
            </div>

            <FileUploader
              onUploaded={(att) => {
                if (!att || typeof att !== 'object' || !att.file_name) {
                  console.warn('Invalid upload response:', att);
                  return;
                }
                setAttachments((prev) => [...prev, att]);
                setErrors((s) => ({ ...s, attachments: undefined }));
              }}
            />

            {errors.attachments && (
              <p className="text-red-500 text-xs mt-1 font-semibold">{errors.attachments}</p>
            )}

            {safeAttachments.length > 0 && (
              <div className="mt-3 space-y-2">
                {safeAttachments.map((a, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
                      isDe ? 'bg-teal-50 border-teal-100' : 'bg-emerald-50 border-emerald-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={isDe ? 'text-teal-600' : 'text-emerald-500'}>✓</span>
                      <span className="text-sm">{a.file_name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="text-red-400 hover:text-red-600 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {amount !== '' && (!amount || isNaN(Number(amount)) || Number(amount) <= 0) && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>Amount must be greater than 0.00. Requests with an amount of 0 or less are not accepted.</span>
            </div>
          )}

          {Number(amount) > 0 && !fundSufficient && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>Insufficient funds available for <strong>{currency}</strong>. Please contact the Finance Department.</span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={submitting || !amount || isNaN(Number(amount)) || Number(amount) <= 0 || !fundSufficient}
              className={`px-6 py-2.5 rounded-xl font-semibold text-sm text-white shadow-md transition-all disabled:opacity-50 ${
                isDe
                  ? 'bg-gradient-to-r from-teal-600 to-cyan-700 hover:from-teal-700 hover:to-cyan-800'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800'
              }`}
            >
              {submitting
                ? 'Saving...'
                : !amount || isNaN(Number(amount)) || Number(amount) <= 0
                ? 'Enter Amount (> 0)'
                : !fundSufficient
                ? 'Insufficient Funds'
                : isDe
                ? 'Save Direct Expense'
                : 'Save IOU Request'}
            </button>
            <Button
              variant="secondary"
              onClick={() => nav(isDe ? '/direct-expenses' : '/ious')}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
