// src/components/charts/ApprovedAmountsChart.jsx
import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const CURRENCY_COLORS = { GHS: '#34d399', USD: '#60a5fa', EUR: '#c084fc', GBP: '#f472b6' };

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
    <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl p-3 text-sm">
      <p className="font-bold text-white mb-1.5">{label || 'Summary'}</p>
      {payload.map((entry, i) => (
        <p key={i} className="flex items-center gap-2 text-xs">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-400">{entry.name}:</span>
          <span className="font-semibold text-white">{formatCurrency(entry.value, entry.name)}</span>
        </p>
      ))}
    </div>
  );
};

/**
 * Props:
 * - amounts: { weekly: { GHS: 100, USD: 50 }, monthly: {...}, yearly: {...}, overall: {...} }
 * - monthlyChart: [ { month: "Jan 2025", GHS: 1000, USD: 500 }, ... ]
 * - currencies: array of currency objects [{ code, is_active, ... }]
 */
export default function ApprovedAmountsChart({ amounts = {}, monthlyChart = [], currencies = [] }) {
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

  // If a currency is deactivated and its amount for this period is 0, do not display it
  const visibleCurrencies = useMemo(() => {
    return allCurrencies.filter(cur => {
      const currObj = currencies.find(c => c.code === cur);
      const isActive = currObj ? !!currObj.is_active : true;
      const amt = currentAmounts[cur] || 0;
      if (!isActive && amt <= 0) return false;
      return true;
    });
  }, [allCurrencies, currencies, currentAmounts]);

  return (
    <div>
      {/* Tab selector */}
      <div className="flex gap-1 mb-4 bg-white/10 border border-white/10 rounded-xl p-1 w-fit">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
              activeTab === tab.key
                ? 'bg-teal-500 text-white shadow-md'
                : 'text-teal-200/70 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Currency amount cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {visibleCurrencies.map(cur => (
          <div
            key={cur}
            className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10"
            style={{ borderLeftColor: CURRENCY_COLORS[cur] || '#2dd4bf', borderLeftWidth: 3 }}
          >
            <span
              className="text-xs font-bold px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: (CURRENCY_COLORS[cur] || '#2dd4bf') + '33',
                color: CURRENCY_COLORS[cur] || '#2dd4bf'
              }}
            >
              {cur}
            </span>
            <span className="text-sm font-bold text-white">
              {formatCurrency(currentAmounts[cur] || 0, cur)}
            </span>
          </div>
        ))}
        {visibleCurrencies.length === 0 && (
          <div className="col-span-4 text-sm text-teal-200/60 py-2">No approved amounts to display</div>
        )}
      </div>

      {/* Bar chart: monthly approved by currency */}
      {monthlyChart.length > 0 && (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={monthlyChart} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8, color: '#cbd5e1' }} iconType="circle" iconSize={8} />
            {allCurrencies.map(cur => (
              <Bar
                key={cur}
                dataKey={cur}
                name={cur}
                fill={CURRENCY_COLORS[cur] || '#2dd4bf'}
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
