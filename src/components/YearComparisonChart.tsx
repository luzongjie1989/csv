import { useState, useMemo, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Plus, X } from 'lucide-react';
import { extractYearLine, getCurrentYearAndEndDate, getAvailableYears, alignLinesForChart } from '@/utils/yearComparison';
import { fmtPct } from '@/utils/seasonalStats';
import type { ParsedCSV } from '@/types';

interface Props { data: ParsedCSV; }

const LINE_COLORS = [
  '#f43f5e', // rose
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
];

export default function YearComparisonChart({ data }: Props) {
  const currentInfo = useMemo(() => getCurrentYearAndEndDate(data), [data]);
  const availableYears = useMemo(() => getAvailableYears(data), [data]);

  // 默认显示当前年份 + 前一个年份（如果有）
  const defaultYears = useMemo(() => {
    if (!currentInfo) return [];
    const years: number[] = [currentInfo.year];
    const prev = availableYears.filter(y => y < currentInfo.year);
    if (prev.length > 0) years.push(prev[prev.length - 1]);
    return years;
  }, [currentInfo, availableYears]);

  const [compareYears, setCompareYears] = useState<number[]>(defaultYears);
  const [inputYear, setInputYear] = useState('');

  const addYear = useCallback(() => {
    const y = parseInt(inputYear);
    if (isNaN(y) || y < 1000 || y > 9999) return;
    if (compareYears.includes(y)) return;
    if (!availableYears.includes(y)) return;
    setCompareYears(prev => [...prev, y]);
    setInputYear('');
  }, [inputYear, compareYears, availableYears]);

  const removeYear = useCallback((y: number) => {
    setCompareYears(prev => prev.filter(year => year !== y));
  }, []);

  // 生成各年份走势线
  const lines = useMemo(() => {
    if (!currentInfo) return [];
    const result = [];
    for (const year of compareYears) {
      const line = extractYearLine(data, year, currentInfo.month, currentInfo.day, year === currentInfo.year);
      if (line) result.push(line);
    }
    return result;
  }, [data, compareYears, currentInfo]);

  // 对齐数据用于Recharts
  const { chartData } = useMemo(() => alignLinesForChart(lines), [lines]);

  if (!currentInfo || lines.length === 0) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center text-slate-400 text-sm">
        暂无足够数据绘制年份比对图
      </div>
    );
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-medium text-sm">不同年份趋势行情比对</h3>
            <span className="text-slate-500 text-xs">
              截至 {currentInfo.month}月{currentInfo.day}日
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            {lines.map((line, i) => (
              <span key={line.year} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: LINE_COLORS[i % LINE_COLORS.length] }} />
                <span className={line.isCurrent ? 'text-amber-400 font-medium' : ''}>{line.year}</span>
                <span className={line.finalReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  ({fmtPct(line.finalReturn)})
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 年份控制 */}
      <div className="px-4 py-2 border-b border-slate-700/50 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500">比对年份:</span>
        {compareYears.map((year, i) => (
          <span
            key={year}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
              year === currentInfo.year
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'bg-slate-700/30 text-slate-300 border border-slate-600'
            }`}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: LINE_COLORS[i % LINE_COLORS.length] }} />
            {year}年
            <button
              onClick={() => removeYear(year)}
              className="ml-0.5 text-slate-500 hover:text-slate-300"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <div className="flex items-center gap-1 ml-1">
          <input
            type="number"
            value={inputYear}
            onChange={e => setInputYear(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addYear()}
            placeholder="年份"
            className="w-16 px-2 py-1 rounded bg-slate-700/50 border border-slate-600 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            min={1000}
            max={9999}
          />
          <button
            onClick={addYear}
            className="px-2 py-1 rounded bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 text-xs transition-colors"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
        <span className="text-[10px] text-slate-600">
          可用: {availableYears.slice(0, 10).join(', ')}{availableYears.length > 10 ? '...' : ''}
        </span>
      </div>

      {/* Chart */}
      <div className="px-4 py-4">
        <div className="w-full" style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="day"
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                axisLine={{ stroke: '#475569' }}
                tickLine={false}
                label={{ value: '交易日', position: 'insideBottomRight', offset: -5, style: { fill: '#64748b', fontSize: 10 } }}
              />
              <YAxis
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                axisLine={{ stroke: '#475569' }}
                tickLine={false}
                domain={['auto', 'auto']}
                tickFormatter={(v: number) => v.toFixed(0)}
                label={{ value: '归一化指数(起点=100)', angle: -90, position: 'insideLeft', offset: 10, style: { fill: '#64748b', fontSize: 10 } }}
              />
              <Tooltip content={<ComparisonTooltip lines={lines} />} />
              {lines.map((line, i) => (
                <Line
                  key={line.label}
                  type="monotone"
                  dataKey={line.label}
                  stroke={LINE_COLORS[i % LINE_COLORS.length]}
                  strokeWidth={line.isCurrent ? 2.5 : 1.5}
                  strokeDasharray={line.isCurrent ? undefined : '5 3'}
                  dot={false}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/** 比对Tooltip */
function ComparisonTooltip({ active, payload, lines }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 shadow-xl min-w-[140px]">
      <p className="text-slate-400 text-xs">第{payload[0].payload.day}个交易日</p>
      <div className="mt-1 space-y-0.5">
        {payload
          .filter((p: any) => p.value != null)
          .map((p: any, i: number) => {
            const line = lines[i];
            if (!line) return null;
            return (
              <div key={p.dataKey} className="flex items-center justify-between gap-4">
                <span className="text-xs text-slate-300">{p.dataKey}</span>
                <span className="text-xs font-medium text-slate-200">{p.value?.toFixed(2)}</span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
