import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { calcMonthlyStats, calcWeeklyStats, calcQuarterlyStats, calcYearTailStats, fmtPct, fmtWinRate } from '@/utils/seasonalStats';
import type { ParsedCSV } from '@/types';

type SubTab = 'month' | 'week' | 'quarter' | 'yearTail';

interface Props { data: ParsedCSV; }

const TABS: { key: SubTab; label: string }[] = [
  { key: 'month', label: '月度效应' },
  { key: 'week', label: '星期效应' },
  { key: 'quarter', label: '季度效应' },
  { key: 'yearTail', label: '年度尾数' },
];

export default function SeasonalAnalysis({ data }: Props) {
  const [tab, setTab] = useState<SubTab>('month');

  const stats = useMemo(() => ({
    month: calcMonthlyStats(data),
    week: calcWeeklyStats(data),
    quarter: calcQuarterlyStats(data),
    yearTail: calcYearTailStats(data),
  }), [data]);

  const currentStats = stats[tab];

  if (!currentStats || currentStats.length === 0) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center text-slate-400 text-sm">
        暂无足够的日期和收盘价数据，无法进行季节性分析
      </div>
    );
  }

  const chartData = currentStats.map(s => ({
    name: s.label,
    value: s.avgReturn,
    count: s.count,
    upCount: s.upCount,
    downCount: s.downCount,
    winRate: s.count > 0 ? s.upCount / s.count : 0,
    totalReturn: s.totalReturn,
    hasData: s.hasData,
  }));

  const hasDataCount = currentStats.filter(s => s.hasData).length;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-white font-medium text-sm">传统金融数据的季节性分析</h3>
          <span className="text-slate-500 text-xs">基于历史日度收益率统计</span>
        </div>
        <span className="text-slate-400 text-xs">有数据 {hasDataCount}/{currentStats.length}</span>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 border-b border-slate-700">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`py-3 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'text-emerald-400 bg-emerald-500/10 border-b-2 border-emerald-400'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/20'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="px-4 py-4">
        <div className="w-full" style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#475569' }} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={{ stroke: '#475569' }} tickLine={false} tickFormatter={(v: number) => (v * 100).toFixed(0) + '%'} />
              <Tooltip content={<SeasonalTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={tab === 'yearTail' ? 32 : 48}>
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={entry.value >= 0 ? '#10b981' : '#f43f5e'} fillOpacity={entry.hasData ? 0.85 : 0.2} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="border-t border-slate-700 px-4 py-3">
        <div className={`grid gap-2 ${
          tab === 'week' ? 'grid-cols-5'
          : tab === 'quarter' ? 'grid-cols-4'
          : tab === 'yearTail' ? 'grid-cols-5 sm:grid-cols-10'
          : 'grid-cols-4 sm:grid-cols-6 md:grid-cols-12'
        }`}>
          {currentStats.map(s => (
            <div key={s.label} className={`text-center p-2 rounded-lg ${s.hasData ? 'bg-slate-700/30' : 'bg-slate-700/10 opacity-30'}`}>
              <p className="text-xs font-medium text-slate-300">{s.label}</p>
              <p className={`text-xs font-bold mt-0.5 ${s.hasData ? (s.avgReturn >= 0 ? 'text-emerald-400' : 'text-rose-400') : 'text-slate-500'}`}>
                {s.hasData ? fmtPct(s.avgReturn) : '-'}
              </p>
              {s.hasData && (
                <div className="mt-1 space-y-0.5">
                  <p className="text-[9px] text-slate-500">胜率 {fmtWinRate(s.upCount, s.count)}</p>
                  <p className="text-[9px] text-slate-500">累计 {fmtPct(s.totalReturn)}</p>
                  <p className="text-[9px] text-slate-500">n={s.count}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Tooltip */
function SeasonalTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  if (!d.hasData) return null;
  return (
    <div className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 shadow-xl min-w-[140px]">
      <p className="text-white text-sm font-medium">{d.name}</p>
      <p className="text-slate-500 text-xs">样本: {d.count} (涨{d.upCount} / 跌{d.downCount})</p>
      <p className="text-amber-300 text-xs">胜率: {(d.winRate * 100).toFixed(1)}%</p>
      <p className={`text-xs font-bold mt-1 ${d.value >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
        平均: {fmtPct(d.value)}
      </p>
      <p className={`text-xs font-semibold ${d.totalReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
        累计: {fmtPct(d.totalReturn)}
      </p>
    </div>
  );
}
