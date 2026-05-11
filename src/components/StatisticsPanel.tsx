import { useState, useMemo } from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { generateStatsReport, fmtPct } from '@/utils/statistics';
import { getSolarTermColor } from '@/utils/solarTerms';
import type { ParsedCSV } from '@/types';
import { TrendingUp, BarChart4 } from 'lucide-react';

type TabKey = 'year' | 'month' | 'day' | 'solarTerm';

interface StatisticsPanelProps {
  data: ParsedCSV;
}

const TABS: { key: TabKey; label: string; icon: string; color: string }[] = [
  { key: 'year', label: '年柱统计', icon: '☯', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
  { key: 'month', label: '月柱统计', icon: '☽', color: 'text-purple-400 border-purple-500/30 bg-purple-500/10' },
  { key: 'day', label: '日柱统计', icon: '☀', color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10' },
  { key: 'solarTerm', label: '节气统计', icon: '❄', color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
];

export default function StatisticsPanel({ data }: StatisticsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('year');

  const report = useMemo(() => generateStatsReport(data), [data]);

  if (!report) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center">
        <p className="text-slate-400 text-sm">暂无收盘价数据，无法计算对数收益率统计</p>
      </div>
    );
  }

  const currentStats = activeTab === 'year' ? report.yearPillarStats
    : activeTab === 'month' ? report.monthPillarStats
    : activeTab === 'day' ? report.dayPillarStats
    : report.solarTermStats;

  const hasDataCount = currentStats.filter(s => s.hasData).length;
  const allMean = currentStats.filter(s => s.hasData).reduce((sum, s) => sum + s.mean, 0) / (hasDataCount || 1);

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart4 className="w-4 h-4 text-cyan-400" />
          <h3 className="text-white font-medium text-sm">对数收益率统计</h3>
          <span className="text-slate-500 text-xs">rₜ = ln(Pₜ / Pₜ₋₁)</span>
        </div>
        <span className="text-slate-400 text-xs">
          有数据 {hasDataCount} / {activeTab === 'solarTerm' ? 24 : 60}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-all border-b-2 ${
              activeTab === tab.key
                ? `${tab.color} border-current -mb-[1px]`
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-700/30'
            }`}
          >
            <span className="mr-1.5">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Summary bar */}
      <div className="px-4 py-2 bg-slate-800/50 border-b border-slate-700/50 flex items-center gap-6">
        <SummaryItem
          icon={<TrendingUp className="w-3 h-3" />}
          label="均值(平均)"
          value={fmtPct(allMean)}
          color={allMean >= 0 ? 'text-emerald-400' : 'text-rose-400'}
        />
        <SummaryItem
          icon={<BarChart4 className="w-3 h-3" />}
          label="样本组数"
          value={`${hasDataCount}`}
          color="text-cyan-400"
        />
      </div>

      {/* Stats Table */}
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10">
            <TableRow className="border-slate-700 hover:bg-transparent bg-slate-800">
              <TableHead className="text-slate-400 font-medium text-xs w-16">
                {activeTab === 'solarTerm' ? '节气' : '干支'}
              </TableHead>
              <TableHead className="text-cyan-400 font-medium text-xs">次数</TableHead>
              <TableHead className="text-cyan-400 font-medium text-xs">均值</TableHead>
              <TableHead className="text-cyan-400 font-medium text-xs">标准差</TableHead>
              <TableHead className="text-cyan-400 font-medium text-xs">最小</TableHead>
              <TableHead className="text-cyan-400 font-medium text-xs">最大</TableHead>
              <TableHead className="text-cyan-400 font-medium text-xs">累计</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentStats.map((stat) => (
              <TableRow
                key={stat.label}
                className={`border-slate-700/50 transition-colors ${
                  stat.hasData ? 'hover:bg-slate-700/30' : 'opacity-30'
                }`}
              >
                {/* Label cell */}
                <TableCell className="text-xs font-medium whitespace-nowrap">
                  {activeTab === 'solarTerm' ? (
                    <SolarTermBadge name={stat.label} />
                  ) : (
                    <span className={stat.hasData ? 'text-amber-300' : 'text-slate-500'}>
                      {stat.label}
                    </span>
                  )}
                </TableCell>

                {/* Stats cells */}
                <TableCell className="text-slate-300 text-xs whitespace-nowrap tabular-nums">
                  {stat.hasData ? stat.count : '-'}
                </TableCell>
                <TableCell className={`text-xs whitespace-nowrap tabular-nums font-medium ${
                  !stat.hasData ? 'text-slate-500' : stat.mean >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {stat.hasData ? fmtPct(stat.mean) : '-'}
                </TableCell>
                <TableCell className="text-slate-300 text-xs whitespace-nowrap tabular-nums">
                  {stat.hasData ? fmtPct(stat.std) : '-'}
                </TableCell>
                <TableCell className="text-rose-400 text-xs whitespace-nowrap tabular-nums">
                  {stat.hasData ? fmtPct(stat.min) : '-'}
                </TableCell>
                <TableCell className="text-emerald-400 text-xs whitespace-nowrap tabular-nums">
                  {stat.hasData ? fmtPct(stat.max) : '-'}
                </TableCell>
                <TableCell className={`text-xs whitespace-nowrap tabular-nums font-medium ${
                  !stat.hasData ? 'text-slate-500' : stat.sum >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {stat.hasData ? fmtPct(stat.sum) : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/** Summary item in header bar */
function SummaryItem({ icon, label, value, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-slate-500">{icon}</span>
      <span className="text-slate-400 text-xs">{label}:</span>
      <span className={`text-xs font-medium ${color}`}>{value}</span>
    </div>
  );
}

/** Solar term badge with seasonal color */
function SolarTermBadge({ name }: { name: string }) {
  const colors = getSolarTermColor(name);
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs ${colors.bg} ${colors.text}`}>
      {name}
    </span>
  );
}
