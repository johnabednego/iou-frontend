// src/components/charts/ApprovedAmountsChart.jsx
import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const CURRENCY_COLORS = { GHS: '#065f46', USD: '#1d4ed8', EUR: '#7c3aed', GBP: '#be185d' };

function formatCurrency(n, currency = 'GHS') {
  if (n == null) return `${currency} 0.00`;
  const localeMap = { GHS: 'en-GH', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB' };
  return new Intl.NumberFormat(localeMap[currency] || 'en-US', { style: 'currency', currency }).format(n);
}

const TABS = [
  { key: 'weekly', label: 'This Week' },
  { key: 'monthly', label: 'This Month' },
  { key: 'yearly', label: 'This Year' },
  { key: 'overall', label: 'Overall' }
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-slate-700 mb-1.5">{label || 'Summary'}</p>
      {payload.map((entry, i) => (
        <p key={i} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-600">{entry.name}:</span>
          <span className="font-semibold text-slate-800">{formatCurrency(entry.value, entry.name)}</span>
        </p>
      ))}
    </div>
  );
};

/**
 * Props:
 * - amounts: { weekly: { GHS: 100, USD: 50 }, monthly: {...}, yearly: {...}, overall: {...} }
 * - monthlyChart: [ { month: "Jan 2025", GHS: 1000, USD: 500 }, ... ]
 */
export default function ApprovedAmountsChart({ amounts = {}, monthlyChart = [] }) {
  const [activeTab, setActiveTab] = useState('monthly');

  // Get all currencies from the data
  const allCurrencies = useMemo(() => {
    const set = new Set();
    for (const period of Object.values(amounts)) {
      for (const code of Object.keys(period || {})) set.add(code);
    }
    for (const entry of monthlyChart) {
      for (const key of Object.keys(entry)) {
        if (key !== 'month') set.add(key);
      }
    }
    return Array.from(set).sort();
  }, [amounts, monthlyChart]);

  // Summary cards for the selected period
  const currentAmounts = amounts[activeTab] || {};

  return (
    <div>
      {/* Tab selector */}
      <div className="flex gap-1 mb-4 bg-slate-100 rounded-lg p-1 w-fit">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
              activeTab === tab.key
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Currency amount cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {allCurrencies.map(cur => (
          <div
            key={cur}
            className="flex items-center gap-2 p-3 rounded-lg border border-slate-100"
            style={{ borderLeftColor: CURRENCY_COLORS[cur] || '#6366f1', borderLeftWidth: 3 }}
          >
            <span
              className="text-xs font-bold px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: (CURRENCY_COLORS[cur] || '#6366f1') + '18',
                color: CURRENCY_COLORS[cur] || '#6366f1'
              }}
            >
              {cur}
            </span>
            <span className="text-sm font-semibold text-slate-700">
              {formatCurrency(currentAmounts[cur] || 0, cur)}
            </span>
          </div>
        ))}
        {allCurrencies.length === 0 && (
          <div className="col-span-4 text-sm text-slate-400">No approved amounts to display</div>
        )}
      </div>

      {/* Bar chart: monthly approved by currency */}
      {monthlyChart.length > 0 && (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={monthlyChart} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" iconSize={8} />
            {allCurrencies.map(cur => (
              <Bar
                key={cur}
                dataKey={cur}
                name={cur}
                fill={CURRENCY_COLORS[cur] || '#6366f1'}
                radius={[4, 4, 0, 0]}
                opacity={0.85}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
