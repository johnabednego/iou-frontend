// src/components/charts/StatusDistributionChart.jsx
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const STATUS_COLORS = {
  'Draft': '#94a3b8',
  'Awaiting Assignment': '#818cf8',
  'Pending': '#fbbf24',
  'Approved': '#34d399',
  'For Disbursement': '#10b981',
  'Disbursed': '#38bdf8',
  'Funds Confirmed': '#60a5fa',
  'Expense Submitted': '#c084fc',
  'Expense Approval': '#fb923c',
  'Reconciled': '#2dd4bf',
  'Redeemed': '#4ade80',
  'Returned': '#facc15',
  'Rejected': '#f87171',
  'Cancelled': '#9ca3af'
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { label, count } = payload[0].payload;
  return (
    <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl p-3 text-sm">
      <p className="font-bold text-white mb-1">{label}</p>
      <p className="flex items-center gap-2 text-xs">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[label] || '#fbbf24' }} />
        <span className="text-slate-400">Count:</span>
        <span className="font-semibold text-white">{count}</span>
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
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fontSize: 11, fill: '#cbd5e1' }}
          axisLine={false}
          tickLine={false}
          width={120}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
        <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={18}>
          {sorted.map((entry, index) => (
            <Cell key={index} fill={STATUS_COLORS[entry.label] || '#fbbf24'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
