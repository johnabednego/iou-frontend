// src/components/charts/StatusDistributionChart.jsx
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const STATUS_COLORS = {
  'Draft': '#94a3b8',
  'Awaiting Assignment': '#818cf8',
  'Pending': '#f59e0b',
  'Approved': '#10b981',
  'For Disbursement': '#059669',
  'Disbursed': '#3b82f6',
  'Funds Confirmed': '#2563eb',
  'Expense Submitted': '#a855f7',
  'Expense Approval': '#f97316',
  'Reconciled': '#14b8a6',
  'Redeemed': '#22c55e',
  'Returned': '#eab308',
  'Rejected': '#ef4444',
  'Cancelled': '#6b7280'
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { label, count } = payload[0].payload;
  return (
    <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      <p className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[label] || '#6366f1' }} />
        <span className="text-slate-600">Count:</span>
        <span className="font-semibold text-slate-800">{count}</span>
      </p>
    </div>
  );
};

export default function StatusDistributionChart({ data = [] }) {
  if (!data.length) return <div className="text-center text-slate-400 py-8">No data available</div>;

  const sorted = [...data].sort((a, b) => b.count - a.count);

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={sorted} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: '#64748b' }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fontSize: 11, fill: '#64748b' }}
          axisLine={false}
          tickLine={false}
          width={120}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
        <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={18}>
          {sorted.map((entry, index) => (
            <Cell key={index} fill={STATUS_COLORS[entry.label] || '#6366f1'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
