// src/components/charts/MonthlyIOUChart.jsx
import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl p-3 text-sm">
      <p className="font-bold text-white mb-1.5">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="flex items-center gap-2 text-xs">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-400">{entry.name}:</span>
          <span className="font-semibold text-white">{entry.value}</span>
        </p>
      ))}
    </div>
  );
};

export default function MonthlyIOUChart({ data = [] }) {
  if (!data.length) return <div className="text-center text-slate-400 py-8">No data available</div>;

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="gradApproved" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity={0.95} />
            <stop offset="100%" stopColor="#059669" stopOpacity={0.8} />
          </linearGradient>
          <linearGradient id="gradPending" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.95} />
            <stop offset="100%" stopColor="#d97706" stopOpacity={0.8} />
          </linearGradient>
          <linearGradient id="gradRejected" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f87171" stopOpacity={0.95} />
            <stop offset="100%" stopColor="#dc2626" stopOpacity={0.8} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={{ stroke: 'rgba(255,255,255,0.15)' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 8, color: '#cbd5e1' }}
          iconType="circle"
          iconSize={8}
        />
        <Bar dataKey="approved" name="Approved" fill="url(#gradApproved)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="pending" name="Pending" fill="url(#gradPending)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="rejected" name="Rejected" fill="url(#gradRejected)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
