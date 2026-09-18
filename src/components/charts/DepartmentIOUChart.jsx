// src/components/charts/DepartmentIOUChart.jsx
import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

const COLORS = [
  '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899',
  '#06b6d4', '#6366f1', '#14b8a6', '#f97316', '#84cc16'
];

const CustomTooltip = ({ active, payload, metric }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl p-3 text-sm">
      <p className="font-bold text-white mb-1">{d.department}</p>
      <p className="text-xs text-blue-300">
        Requests: <span className="font-semibold text-white">{d.count}</span>
      </p>
      <p className="text-xs text-emerald-300">
        Estimated: <span className="font-semibold text-white">GHS {Number(d.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
      </p>
    </div>
  );
};

export default function DepartmentIOUChart({ data = [] }) {
  const [metric, setMetric] = useState('count'); // 'count' or 'total_amount'

  if (!data.length) {
    return <div className="text-center text-slate-400 py-12">No department data available</div>;
  }

  // Sort descending by selected metric and take top 10
  const sorted = [...data]
    .sort((a, b) => (metric === 'count' ? b.count - a.count : b.total_amount - a.total_amount))
    .slice(0, 10);

  return (
    <div className="space-y-3">
      <div className="flex justify-end items-center gap-1.5">
        <button
          type="button"
          onClick={() => setMetric('count')}
          className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
            metric === 'count'
              ? 'bg-blue-600 text-white shadow'
              : 'bg-white/10 text-slate-300 hover:bg-white/20'
          }`}
        >
          By Request Count
        </button>
        <button
          type="button"
          onClick={() => setMetric('total_amount')}
          className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
            metric === 'total_amount'
              ? 'bg-blue-600 text-white shadow'
              : 'bg-white/10 text-slate-300 hover:bg-white/20'
          }`}
        >
          By Total Amount
        </button>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={{ stroke: 'rgba(255,255,255,0.15)' }}
            tickLine={false}
            tickFormatter={(val) => (metric === 'count' ? val : val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
          />
          <YAxis
            type="category"
            dataKey="department"
            tick={{ fontSize: 11, fill: '#e2e8f0' }}
            axisLine={false}
            tickLine={false}
            width={120}
            tickFormatter={(val) => (val.length > 15 ? val.slice(0, 15) + '…' : val)}
          />
          <Tooltip content={<CustomTooltip metric={metric} />} />
          <Bar dataKey={metric} radius={[0, 8, 8, 0]} maxBarSize={24}>
            {sorted.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
