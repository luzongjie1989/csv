import { useState, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import { Activity, BarChart3, GitPullRequest, List } from 'lucide-react';
import {
  identifyDrawdowns, calcUnderwaterCurve, classifyDrawdowns,
  getMaxDrawdown, getCurrentDrawdown, fmtDrawdownPct,
  type DrawdownRecord, type DrawdownCategory, type UnderwaterPoint,
} from '@/utils/drawdownStats';
import type { ParsedCSV } from '@/types';

type SubTab = 'underwater' | 'distribution' | 'scatter' | 'table';

interface Props { data: ParsedCSV; }

const TABS: { key: SubTab; label: string; icon: typeof Activity }[] = [
  { key: 'underwater', label: '回撤曲线', icon: Activity },
  { key: 'distribution', label: '跌幅分布', icon: BarChart3 },
  { key: 'scatter', label: '持续分析', icon: GitPullRequest },
  { key: 'table', label: '明细表', icon: List },
];

export default function DrawdownAnalysis({ data }: Props) {
  const [tab, setTab] = useState<SubTab>('underwater');

  const drawdowns = useMemo(() => identifyDrawdowns(data), [data]);
  const underwaterData = useMemo(() => calcUnderwaterCurve(data), [data]);
  const categories = useMemo(() => classifyDrawdowns(drawdowns), [drawdowns]);
  const maxDD = useMemo(() => getMaxDrawdown(drawdowns), [drawdowns]);
  const currentDD = useMemo(() => getCurrentDrawdown(drawdowns), [drawdowns]);

  if (drawdowns.length === 0) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center text-slate-400 text-sm">
        暂无足够的日期和收盘价数据，无法进行回撤分析
      </div>
    );
  }

  // 概览卡片数据
  const totalDrawdowns = drawdowns.length;
  const recoveredCount = drawdowns.filter(d => d.isRecovered).length;
  const avgDuration = drawdowns.reduce((s, d) => s + d.durationDays, 0) / totalDrawdowns;
  const avgRecoveryDays = drawdowns.filter(d => d.isRecovered).reduce((s, d) => s + (d.recoveryDays || 0), 0) / Math.max(recoveredCount, 1);

  return (
    <div className="space-y-6">
      {/* 概览卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          label="最大回撤"
          value={maxDD ? fmtDrawdownPct(maxDD.drawdownPct) : '-'}
          sub={maxDD ? `${maxDD.peakDate} → ${maxDD.troughDate}` : ''}
          color="text-rose-400"
        />
        <SummaryCard
          label="当前回撤"
          value={currentDD ? fmtDrawdownPct(currentDD.drawdownPct) : '已恢复'}
          sub={currentDD ? `持续 ${currentDD.durationDays} 天` : '无未恢复回撤'}
          color={currentDD ? 'text-amber-400' : 'text-emerald-400'}
        />
        <SummaryCard
          label="回撤次数"
          value={`${totalDrawdowns}`}
          sub={`已恢复 ${recoveredCount} 次`}
          color="text-cyan-400"
        />
        <SummaryCard
          label="平均持续/恢复"
          value={`${avgDuration.toFixed(0)}天 / ${avgRecoveryDays.toFixed(0)}天`}
          sub="峰→谷 / 峰→恢复"
          color="text-blue-400"
        />
      </div>

      {/* 分类概览条 */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <h3 className="text-white font-medium text-sm mb-3">跌幅分类统计</h3>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {categories.map(cat => (
            <div
              key={cat.label}
              className="rounded-lg p-3 text-center"
              style={{ backgroundColor: cat.bgColor }}
            >
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                <span className="text-xs font-medium" style={{ color: cat.color }}>{cat.label}</span>
              </div>
              <p className="text-white text-lg font-bold">{cat.count}</p>
              <p className="text-slate-400 text-[10px] mt-0.5">
                {cat.count > 0 ? `均跌${cat.avgDrawdown.toFixed(1)}%` : '-'}
              </p>
              <p className="text-slate-500 text-[10px]">
                {cat.count > 0 ? `均${cat.avgDuration.toFixed(0)}天 恢复${cat.recoveryRate.toFixed(0)}%` : '-'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 子标签切换 */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="grid grid-cols-4 border-b border-slate-700">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
                  tab === t.key
                    ? 'text-rose-400 bg-rose-500/10 border-b-2 border-rose-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/20'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="p-4">
          {tab === 'underwater' && <UnderwaterChart data={underwaterData} drawdowns={drawdowns} />}
          {tab === 'distribution' && <DistributionChart categories={categories} />}
          {tab === 'scatter' && <ScatterPlot drawdowns={drawdowns} />}
          {tab === 'table' && <DetailTable drawdowns={drawdowns} categories={categories} />}
        </div>
      </div>
    </div>
  );
}

/* ============ 概览卡片 ============ */
function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <p className="text-slate-400 text-xs mb-1">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-slate-500 text-[10px] mt-1 truncate">{sub}</p>
    </div>
  );
}

/* ============ 模块1: 水下曲线 ============ */
function UnderwaterChart({ data, drawdowns }: { data: UnderwaterPoint[]; drawdowns: DrawdownRecord[] }) {
  // 采样：数据点超过500时做降采样
  const sampledData = useMemo(() => {
    if (data.length <= 500) return data;
    const step = Math.ceil(data.length / 500);
    const result: UnderwaterPoint[] = [];
    for (let i = 0; i < data.length; i += step) {
      // 每段取最小值（最大回撤点）
      let minPct = 0;
      for (let j = i; j < Math.min(i + step, data.length); j++) {
        if (data[j].drawdownPct < minPct) minPct = data[j].drawdownPct;
      }
      result.push({ date: data[i].date, drawdownPct: minPct });
    }
    return result;
  }, [data]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-white font-medium text-sm">回撤水下曲线</h4>
          <p className="text-slate-500 text-xs">显示每个交易日相对历史高点的回撤百分比</p>
        </div>
        <span className="text-slate-500 text-xs">{data.length} 个数据点</span>
      </div>
      <div style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sampledData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="ddGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              axisLine={{ stroke: '#475569' }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              axisLine={{ stroke: '#475569' }}
              tickLine={false}
              tickFormatter={(v: number) => v.toFixed(0) + '%'}
              domain={['auto', 0]}
            />
            <Tooltip content={<UnderwaterTooltip />} />
            <Area
              type="stepAfter"
              dataKey="drawdownPct"
              stroke="#ef4444"
              strokeWidth={1.5}
              fill="url(#ddGradient)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {/* 最近5次大回撤标注 */}
      <div className="mt-3 flex flex-wrap gap-2">
        {drawdowns
          .sort((a, b) => a.drawdownPct - b.drawdownPct)
          .slice(0, 5)
          .map((dd, i) => (
            <span key={i} className="text-[10px] px-2 py-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
              {dd.peakDate}→{dd.troughDate} {fmtDrawdownPct(dd.drawdownPct)}
            </span>
          ))}
      </div>
    </div>
  );
}

function UnderwaterTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-slate-400 text-xs">{d.date}</p>
      <p className="text-rose-400 text-sm font-bold">{fmtDrawdownPct(d.drawdownPct)}</p>
    </div>
  );
}

/* ============ 模块2: 跌幅分布 ============ */
function DistributionChart({ categories }: { categories: DrawdownCategory[] }) {
  const chartData = categories
    .filter(c => c.count > 0)
    .map(c => ({
      name: c.label,
      count: c.count,
      avgDrawdown: c.avgDrawdown,
      maxDrawdown: c.maxDrawdown,
      avgDuration: c.avgDuration,
      recoveryRate: c.recoveryRate,
      color: c.color,
      bgColor: c.bgColor,
    }));

  return (
    <div>
      <div className="mb-3">
        <h4 className="text-white font-medium text-sm">跌幅分布</h4>
        <p className="text-slate-500 text-xs">按跌幅区间统计回撤发生次数</p>
      </div>
      <div style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={{ stroke: '#475569' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              axisLine={{ stroke: '#475569' }}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<DistributionTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={56}>
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.color} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function DistributionTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 shadow-xl min-w-[160px]">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
        <p className="text-white text-sm font-medium">{d.name}</p>
      </div>
      <p className="text-slate-400 text-xs">发生次数: <span className="text-white font-bold">{d.count}</span></p>
      <p className="text-slate-400 text-xs">平均跌幅: <span className="text-rose-400 font-bold">{fmtDrawdownPct(d.avgDrawdown)}</span></p>
      <p className="text-slate-400 text-xs">最大跌幅: <span className="text-rose-300 font-bold">{fmtDrawdownPct(d.maxDrawdown)}</span></p>
      <p className="text-slate-400 text-xs">平均持续: <span className="text-amber-400">{d.avgDuration.toFixed(0)} 天</span></p>
      <p className="text-slate-400 text-xs">恢复概率: <span className="text-emerald-400">{d.recoveryRate.toFixed(0)}%</span></p>
    </div>
  );
}

/* ============ 模块3: 跌幅 vs 持续时间散点 ============ */
function ScatterPlot({ drawdowns }: { drawdowns: DrawdownRecord[] }) {
  const scatterData = useMemo(() =>
    drawdowns.map((d, i) => ({
      x: d.durationDays,
      y: d.drawdownPct,
      size: Math.abs(d.declinePoints),
      recovered: d.isRecovered,
      peakDate: d.peakDate,
      troughDate: d.troughDate,
      index: i,
    })),
    [drawdowns]
  );

  // 颜色映射
  const getPointColor = (pct: number): string => {
    if (pct > -5) return '#10b981';
    if (pct > -10) return '#3b82f6';
    if (pct > -20) return '#f59e0b';
    if (pct > -30) return '#f97316';
    if (pct > -50) return '#ef4444';
    return '#991b1b';
  };

  return (
    <div>
      <div className="mb-3">
        <h4 className="text-white font-medium text-sm">跌幅 vs 持续时间</h4>
        <p className="text-slate-500 text-xs">散点大小表示下跌点数，颜色表示跌幅区间</p>
      </div>
      <div style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              type="number"
              dataKey="x"
              name="持续天数"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              axisLine={{ stroke: '#475569' }}
              tickLine={false}
              label={{ value: '持续天数', position: 'insideBottomRight', offset: -5, fill: '#64748b', fontSize: 11 }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="跌幅"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              axisLine={{ stroke: '#475569' }}
              tickLine={false}
              tickFormatter={(v: number) => v.toFixed(0) + '%'}
              label={{ value: '跌幅', angle: -90, position: 'insideLeft', offset: 10, fill: '#64748b', fontSize: 11 }}
            />
            <Tooltip content={<ScatterTooltip />} />
            <Scatter data={scatterData} isAnimationActive={false}>
              {scatterData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={getPointColor(entry.y)}
                  fillOpacity={entry.recovered ? 0.7 : 1}
                  stroke={entry.recovered ? 'transparent' : '#fff'}
                  strokeWidth={1}
                  r={Math.max(3, Math.min(12, Math.sqrt(entry.size) * 0.3))}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      {/* 图例 */}
      <div className="flex flex-wrap gap-3 mt-2">
        {[
          { label: '微调(-5%内)', color: '#10b981' },
          { label: '小幅(-5~-10%)', color: '#3b82f6' },
          { label: '中幅(-10~-20%)', color: '#f59e0b' },
          { label: '大幅(-20~-30%)', color: '#f97316' },
          { label: '暴跌(-30~-50%)', color: '#ef4444' },
          { label: '崩盘(-50%以下)', color: '#991b1b' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-slate-400 text-[10px]">{item.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full border border-white bg-slate-500" />
          <span className="text-slate-400 text-[10px]">白边=未恢复</span>
        </div>
      </div>
    </div>
  );
}

function ScatterTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 shadow-xl min-w-[150px]">
      <p className="text-white text-xs font-medium">{d.peakDate} → {d.troughDate}</p>
      <p className="text-rose-400 text-sm font-bold">{fmtDrawdownPct(d.y)}</p>
      <p className="text-slate-400 text-xs">持续 {d.x} 天</p>
      <p className="text-slate-400 text-xs">{d.recovered ? '已恢复' : '未恢复'}</p>
    </div>
  );
}

/* ============ 模块4: 明细表 ============ */
function DetailTable({ drawdowns, categories }: { drawdowns: DrawdownRecord[]; categories: DrawdownCategory[] }) {
  const [sortBy, setSortBy] = useState<'drawdownPct' | 'durationDays' | 'peakDate'>('drawdownPct');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sorted = useMemo(() => {
    const copy = [...drawdowns];
    copy.sort((a, b) => {
      const va = a[sortBy];
      const vb = b[sortBy];
      if (typeof va === 'string' && typeof vb === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return copy;
  }, [drawdowns, sortBy, sortDir]);

  const getCategoryColor = (pct: number): string => {
    const cat = categories.find(c => {
      if (c.max === -Infinity) return pct <= c.min;
      return pct <= c.min && pct > c.max;
    });
    return cat?.color || '#94a3b8';
  };

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir(col === 'drawdownPct' ? 'asc' : 'desc');
    }
  };

  const SortHeader = ({ col, label }: { col: typeof sortBy; label: string }) => (
    <th
      className="px-3 py-2.5 text-left text-xs font-medium text-slate-400 cursor-pointer hover:text-slate-200 transition-colors select-none"
      onClick={() => toggleSort(col)}
    >
      {label}
      {sortBy === col && (
        <span className="ml-1 text-[10px]">{sortDir === 'asc' ? '↑' : '↓'}</span>
      )}
    </th>
  );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h4 className="text-white font-medium text-sm">回撤明细</h4>
          <p className="text-slate-500 text-xs">共 {drawdowns.length} 次回撤，点击列头排序</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-400">#</th>
              <SortHeader col="peakDate" label="峰值日期" />
              <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-400">谷值日期</th>
              <SortHeader col="drawdownPct" label="跌幅" />
              <SortHeader col="durationDays" label="持续天数" />
              <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-400">下跌点数</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-400">恢复日期</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-400">恢复天数</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-400">状态</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((dd, i) => (
              <tr
                key={i}
                className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors"
              >
                <td className="px-3 py-2 text-slate-500 text-xs">{i + 1}</td>
                <td className="px-3 py-2 text-slate-300 text-xs">{dd.peakDate}</td>
                <td className="px-3 py-2 text-slate-300 text-xs">{dd.troughDate}</td>
                <td className="px-3 py-2 text-xs font-bold" style={{ color: getCategoryColor(dd.drawdownPct) }}>
                  {fmtDrawdownPct(dd.drawdownPct)}
                </td>
                <td className="px-3 py-2 text-slate-300 text-xs">{dd.durationDays}</td>
                <td className="px-3 py-2 text-slate-300 text-xs">{dd.declinePoints.toFixed(2)}</td>
                <td className="px-3 py-2 text-slate-300 text-xs">{dd.recoveryDate || '-'}</td>
                <td className="px-3 py-2 text-slate-300 text-xs">{dd.recoveryDays ?? '-'}</td>
                <td className="px-3 py-2 text-xs">
                  {dd.isRecovered ? (
                    <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded text-[10px]">已恢复</span>
                  ) : (
                    <span className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded text-[10px] animate-pulse">进行中</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
