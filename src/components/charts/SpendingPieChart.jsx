// src/components/charts/SpendingPieChart.jsx
import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#ef4444', '#10b981', '#6366f1'];
const LABELS = ['Overspent', 'Underspent', 'Exact'];

const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: payload[0].payload.fill }} />
        <span className="text-slate-600">{name}:</span>
        <span className="font-semibold text-slate-800">{value}</span>
      </p>
    </div>
  );
};

export default function SpendingPieChart({ data = {} }) {
  const { overspent = 0, underspent = 0, exact = 0 } = data;
  const total = overspent + underspent + exact;

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-slate-400">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="mb-2 opacity-40">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
          <path d="M12 2a10 10 0 0 1 0 20" fill="currentColor" opacity="0.15" />
        </svg>
        <span className="text-sm">No reconciliation data yet</span>
      </div>
    );
  }

  const chartData = [
    { name: 'Overspent', value: overspent, fill: COLORS[0] },
    { name: 'Underspent', value: underspent, fill: COLORS[1] },
    { name: 'Exact', value: exact, fill: COLORS[2] }
  ].filter(d => d.value > 0);

  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={110}
          paddingAngle={3}
          dataKey="value"
          labelLine={false}
          label={renderCustomLabel}
          stroke="none"
        >
          {chartData.map((entry, index) => (
            <Cell key={index} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          iconType="circle"
          iconSize={8}
        />
        {/* Center text */}
        <text x="50%" y="48%" textAnchor="middle" dominantBaseline="central" fontSize={22} fontWeight={700} fill="#1e293b">
          {total}
        </text>
        <text x="50%" y="58%" textAnchor="middle" dominantBaseline="central" fontSize={11} fill="#94a3b8">
          Total
        </text>
      </PieChart>
    </ResponsiveContainer>
  );
}
