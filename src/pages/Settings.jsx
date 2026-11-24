import React, { useContext, useEffect, useState } from 'react';
import Card from '../components/ui/Card';
import { AuthContext } from '../contexts/AuthContext';
import { getDateLimit, setDateLimit as setDateLimitApi, getIfsVoucherEditing, setIfsVoucherEditing as setIfsVoucherEditingApi } from '../services/iouService';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

export default function Settings() {
  const { user } = useContext(AuthContext);
  const [minDate, setMinDate] = useState('');
  const [isDefault, setIsDefault] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // IFS Voucher editing state
  const [ifsEditingEnabled, setIfsEditingEnabled] = useState(false);
  const [ifsLoading, setIfsLoading] = useState(true);
  const [ifsSaving, setIfsSaving] = useState(false);
  const [ifsMessage, setIfsMessage] = useState('');
  const [ifsError, setIfsError] = useState('');

  const todayDate = new Date();
  todayDate.setHours(23, 59, 59, 999);

  useEffect(() => {
    loadDateLimit();
    loadIfsVoucherEditing();
  }, []);

  async function loadDateLimit() {
    setLoading(true);
    try {
      const res = await getDateLimit();
      if (res.data?.min_date) {
        setMinDate(res.data.min_date);
        setIsDefault(res.data.is_default || false);
      }
    } catch (err) {
      console.error('Failed to load date limit', err);
      setError('Failed to load current date limit setting.');
    } finally {
      setLoading(false);
    }
  }

  async function loadIfsVoucherEditing() {
    setIfsLoading(true);
    try {
      const res = await getIfsVoucherEditing();
      setIfsEditingEnabled(res.data?.enabled || false);
    } catch (err) {
      console.error('Failed to load IFS voucher editing setting', err);
      setIfsError('Failed to load IFS voucher editing setting.');
    } finally {
      setIfsLoading(false);
    }
  }

  async function handleSave() {
    if (!minDate) {
      setError('Please select a date.');
      return;
    }
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const res = await setDateLimitApi(minDate);
      setMessage(res.data?.message || 'Date limit updated successfully.');
      setIsDefault(false);
    } catch (err) {
      console.error('Failed to save date limit', err);
      setError(err?.response?.data?.message || 'Failed to update date limit.');
    } finally {
      setSaving(false);
    }
  }

  async function handleIfsToggle() {
    const newValue = !ifsEditingEnabled;
    setIfsSaving(true);
    setIfsMessage('');
    setIfsError('');
    try {
      const res = await setIfsVoucherEditingApi(newValue);
      setIfsEditingEnabled(newValue);
      setIfsMessage(res.data?.message || `IFS Voucher editing ${newValue ? 'enabled' : 'disabled'} successfully.`);
    } catch (err) {
      console.error('Failed to toggle IFS voucher editing', err);
      setIfsError(err?.response?.data?.message || 'Failed to update IFS voucher editing setting.');
    } finally {
      setIfsSaving(false);
    }
  }

  const dateObj = minDate ? new Date(minDate) : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Application Settings</h2>
        <p className="text-sm text-slate-500 mt-1">Manage system-wide settings for the IOU Manager.</p>
      </div>

      {/* Date Limit Setting */}
      <Card title="Filter Date Limit">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Set the earliest date that users can select in date filters across the application.
            Users will not be able to filter IOUs before this date. This helps control how far back 
            users can view historical data.
          </p>

          {loading ? (
            <div className="h-10 bg-slate-50 rounded animate-pulse" />
          ) : (
            <>
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Minimum Allowed Date
                  </label>
                  <DatePicker
                    selected={dateObj}
                    onChange={(date) => {
                      setMinDate(date ? date.toISOString().slice(0, 10) : '');
                      setMessage('');
                      setError('');
                    }}
                    maxDate={todayDate}
                    dateFormat="yyyy-MM-dd"
                    placeholderText="Select minimum date..."
                    className="px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm w-full sm:w-56"
                    portalId="datepicker-portal"
                  />
                  {isDefault && (
                    <p className="text-xs text-amber-600 mt-1">
                      ⚠ Currently using default (first day of current month). Set a custom date to override.
                    </p>
                  )}
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving || !minDate}
                  className="px-5 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-700 text-white text-sm font-medium hover:from-blue-600 hover:to-blue-800 transition-all disabled:opacity-50 shadow-sm"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>

              {message && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
                  {message}
                </div>
              )}
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {error}
                </div>
              )}
            </>
          )}

          {/* How date limits work - inside same card to avoid overlap issues */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-start gap-3">
              <div className="text-blue-500 mt-0.5">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </div>
              <div className="text-sm text-slate-600">
                <p className="font-medium text-slate-700 mb-1">How date limits work</p>
                <ul className="list-disc list-inside space-y-1 text-xs text-slate-500">
                  <li>The minimum date applies to all date filter pickers across the Dashboard and Redeemed Requests pages</li>
                  <li>Users cannot select dates before this minimum when filtering IOUs</li>
                  <li>If not set, defaults to the first day of the current month</li>
                  <li>Only administrators can change this setting</li>
                  <li>The setting takes effect immediately for all users</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* IFS Voucher Editing Setting */}
      <Card title="IFS Voucher Number Editing">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            When enabled, cashiers and admins can edit IFS Voucher Numbers on completed or reconciled requests.
            Turn this on when corrections are needed, then turn it off to prevent accidental changes.
          </p>

          {ifsLoading ? (
            <div className="h-10 bg-slate-50 rounded animate-pulse" />
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    IFS Voucher Editing is currently{' '}
                    <span className={ifsEditingEnabled ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>
                      {ifsEditingEnabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {ifsEditingEnabled
                      ? 'Cashiers and admins can edit IFS Voucher Numbers on request detail pages.'
                      : 'IFS Voucher Numbers are locked and cannot be edited.'}
                  </p>
                </div>
                <button
                  onClick={handleIfsToggle}
                  disabled={ifsSaving}
                  className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    ifsEditingEnabled
                      ? 'bg-emerald-500 focus:ring-emerald-500'
                      : 'bg-slate-300 focus:ring-slate-400'
                  } ${ifsSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                      ifsEditingEnabled ? 'translate-x-8' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {ifsMessage && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
                  {ifsMessage}
                </div>
              )}
              {ifsError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {ifsError}
                </div>
              )}
            </>
          )}

          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-start gap-3">
              <div className="text-amber-500 mt-0.5">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div className="text-sm text-slate-600">
                <p className="font-medium text-slate-700 mb-1">Important</p>
                <ul className="list-disc list-inside space-y-1 text-xs text-slate-500">
                  <li>Only enable this when IFS Voucher corrections are needed</li>
                  <li>Disable it after corrections are complete to prevent accidental edits</li>
                  <li>All edits are logged in the audit trail for accountability</li>
                  <li>Only cashiers and admins can edit IFS Voucher Numbers</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
