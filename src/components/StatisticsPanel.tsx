import { useState, useMemo } from 'react';
import { generateStatsReport, fmtPct } from '@/utils/statistics';
import { getSolarTermColor } from '@/utils/solarTerms';
import type { ParsedCSV } from '@/types';

type TabKey = 'year' | 'month' | 'day' | 'solarTerm';

interface Props {
  data: ParsedCSV;
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'year', label: '年柱统计' },
  { key: 'month', label: '月柱统计' },
  { key: 'day', label: '日柱统计' },
  { key: 'solarTerm', label: '节气统计' },
];

export default function StatisticsPanel({ data }: Props) {
  const [tab, setTab] = useState<TabKey>('year');
  const report = useMemo(() => generateStatsReport(data), [data]);

  if (!report) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center text-slate-400 text-sm">
        暂无收盘价数据，无法进行收益率统计
      </div>
    );
  }

  const stats = tab === 'year' ? report.yearPillar
    : tab === 'month' ? report.monthPillar
    : tab === 'day' ? report.dayPillar
    : report.solarTerm;

  const hasDataCount = stats.filter(s => s.count > 0).length;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <h3 className="text-white font-medium text-sm">平均收益率统计</h3>
        <span className="text-slate-400 text-xs">有数据 {hasDataCount} / {stats.length}</span>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 border-b border-slate-700">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`py-3 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'text-amber-400 bg-amber-500/10 border-b-2 border-amber-400'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/20'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Stats Grid */}
      <div className="max-h-[500px] overflow-y-auto">
        <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-px bg-slate-700/30">
          {stats.map(stat => {
            const hasData = stat.count > 0;
            const isPositive = stat.avgReturn > 0;

            return (
              <div
                key={stat.label}
                className={`p-2 text-center ${hasData ? 'bg-slate-800' : 'bg-slate-800/50 opacity-30'}`}
              >
                {/* Label */}
                <div className={`text-xs font-medium mb-1 ${
                  tab === 'solarTerm'
                    ? (hasData ? getSolarTermColor(stat.label).text : 'text-slate-500')
                    : (hasData ? 'text-amber-300' : 'text-slate-500')
                }`}>
                  {stat.label}
                </div>

                {/* Avg Return */}
                <div className={`text-xs font-semibold ${
                  hasData ? (isPositive ? 'text-emerald-400' : 'text-rose-400') : 'text-slate-500'
                }`}>
                  {fmtPct(stat.avgReturn)}
                </div>

                {/* Count */}
                {hasData && (
                  <div className="text-[10px] text-slate-500 mt-0.5">n={stat.count}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
