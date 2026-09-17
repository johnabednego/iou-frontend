// src/components/charts/WeeklyTrendChart.jsx
import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl p-3 text-sm">
      <p className="font-bold text-white mb-1">{label}</p>
      <p className="flex items-center gap-2 text-xs">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        <span className="text-slate-400">IOUs:</span>
        <span className="font-semibold text-white">{payload[0].value}</span>
      </p>
    </div>
  );
};

export default function WeeklyTrendChart({ data = [] }) {
  if (!data.length) return <div className="text-center text-slate-400 py-8">No data available</div>;

  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="gradWeekly" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#34d399" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
        <XAxis
          dataKey="week"
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
        <Area
          type="monotone"
          dataKey="count"
          stroke="#34d399"
          strokeWidth={2.5}
          fill="url(#gradWeekly)"
          dot={{ fill: '#34d399', strokeWidth: 2, r: 4, stroke: '#064e3b' }}
          activeDot={{ fill: '#6ee7b7', r: 6, stroke: '#fff', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
