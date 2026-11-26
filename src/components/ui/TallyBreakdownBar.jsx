import React from 'react';

/**
 * Displays a proportional horizontal stacked bar and clickable tally chips
 * showing how individual segments sum up to the total count.
 */
export default function TallyBreakdownBar({
  title,
  subtitle,
  total = 0,
  segments = [],
  onSegmentClick,
  onTotalClick,
  summaryBadge,
  activeStatus
}) {
  const activeSegments = (segments || []).filter(s => s && s.count > 0);
  const pct = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);

  return (
    <div className="rounded-2xl bg-white/75 backdrop-blur-md border border-slate-200/70 shadow-sm px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">{title}</span>
          {subtitle && (
            <span className="text-xs text-slate-400">{subtitle}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {summaryBadge && (
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
              {summaryBadge}
            </span>
          )}
          <button
            type="button"
            onClick={onTotalClick}
            className="text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-0.5 rounded-full transition"
            title="View all matching requests"
          >
            = {total} Total
          </button>
        </div>
      </div>

      {/* Pictorial stacked progress bar */}
      {total > 0 ? (
        <div className="h-3 w-full rounded-full overflow-hidden bg-slate-100 flex shadow-inner mb-3">
          {activeSegments.map(seg => {
            const widthPct = (seg.count / total) * 100;
            return (
              <button
                key={seg.key}
                type="button"
                onClick={() => onSegmentClick && onSegmentClick(seg)}
                style={{ width: `${widthPct}%` }}
                className={`${seg.barColor} h-full transition-all duration-300 hover:brightness-110 focus:outline-none border-r border-white/40 last:border-r-0`}
                title={`${seg.label}: ${seg.count} (${pct(seg.count)}%) - click to view`}
              />
            );
          })}
        </div>
      ) : (
        <div className="h-2.5 w-full rounded-full bg-slate-100 mb-3" />
      )}

      {/* Clickable tally legend pills */}
      {activeSegments.length === 0 ? (
        <div className="text-xs text-slate-400 italic">No requests in current view</div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {activeSegments.map((seg, idx) => {
            const isSelected = Boolean(activeStatus && seg.status && activeStatus === seg.status);
            return (
              <React.Fragment key={seg.key}>
                {idx > 0 && <span className="text-xs font-bold text-slate-300 select-none">+</span>}
                <button
                  type="button"
                  onClick={() => onSegmentClick && onSegmentClick(seg)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-[box-shadow,filter] duration-150 shadow-2xs hover:shadow ${seg.pillClass} ${isSelected ? 'ring-2 ring-slate-700 font-semibold' : ''}`}
                  title={`Click to filter: ${seg.label} (${seg.count})`}
                >
                  <span className={`w-2 h-2 rounded-full ${seg.dotColor || seg.barColor}`} />
                  <span>{seg.label}</span>
                  <span className="font-extrabold">{seg.count}</span>
                  <span className="text-[11px] opacity-75">({pct(seg.count)}%)</span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
