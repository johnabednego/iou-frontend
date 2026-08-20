import React, { useContext, useEffect, useState } from 'react';
import Card from '../components/ui/Card';
import { AuthContext } from '../contexts/AuthContext';
import { getDateLimit, setDateLimit as setDateLimitApi } from '../services/iouService';
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

  const todayDate = new Date();
  todayDate.setHours(23, 59, 59, 999);

  useEffect(() => {
    loadDateLimit();
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
    </div>
  );
}
