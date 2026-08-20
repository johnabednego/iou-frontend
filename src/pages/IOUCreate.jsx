import React, { useState, useContext } from 'react';
import { createIOU } from '../services/iouService';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import FileUploader from '../components/ui/FileUploader';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';

export default function IOUCreate() {
  const [purpose, setPurpose] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('GHS');
  const [attachments, setAttachments] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const nav = useNavigate();
  const { user } = useContext(AuthContext);

  const safeAttachments = attachments.filter(
    (att) => att && typeof att === 'object' && att.file_name
  );

  function validate() {
    const e = {};
    if (!purpose.trim()) e.purpose = 'Purpose is required';
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      e.amount = 'Enter a valid amount greater than 0';
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
      const res = await createIOU({
        purpose,
        estimated_amount: Number(amount),
        currency: currency || 'GHS',
        attachments: safeAttachments.map((a) => ({
          file_name: a.file_name,
          file_path: a.file_path,
          blob_name: a.blob_name,
          content_type: a.content_type,
          size: a.size
        }))
      });

      setSuccess('IOU created successfully! Redirecting...');
      setTimeout(() => nav(`/ious/${res.data.iou.id}`), 800);
    } catch (err) {
      console.error(err);
      setErrors({
        form: err?.response?.data?.message || 'Failed to create IOU. Please try again.'
      });
    } finally {
      setSubmitting(false);
    }
  }

  function removeAttachment(idx) {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card title="New Request">
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
              placeholder="e.g. Office supplies procurement"
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
                Currency *
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm bg-white"
              >
                <option value="GHS">GHS – Ghana Cedi</option>
                <option value="USD">USD – US Dollar</option>
                <option value="EUR">EUR – Euro</option>
                <option value="GBP">GBP – British Pound</option>
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
            <label className="block text-sm text-slate-700 mb-2">
              Attachments
            </label>

            <FileUploader
              onUploaded={(att) => {
                if (!att || typeof att !== 'object' || !att.file_name) {
                  console.warn('Invalid upload response:', att);
                  return;
                }
                setAttachments((prev) => [...prev, att]);
              }}
            />

            {safeAttachments.length > 0 && (
              <div className="mt-3 space-y-2">
                {safeAttachments.map((a, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-3 py-2 bg-emerald-50 rounded-lg border border-emerald-100"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-500">✓</span>
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

          <div className="flex gap-3 pt-2">
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="secondary" onClick={() => nav('/ious')}>
              Cancel
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}