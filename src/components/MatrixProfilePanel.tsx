import { useState, useMemo, useCallback, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Search, AlertTriangle, GitCompare, Eye } from 'lucide-react';
import { calculateMatrixProfile, findSimilarPatterns } from '@/utils/matrixProfile';
import { fmtPct } from '@/utils/seasonalStats';
import { parseDate } from '@/utils/seasonalStats';
import type { ParsedCSV } from '@/types';
import type { HighlightedPattern } from '@/types/chart';

interface Props {
  data: ParsedCSV;
  onHighlightPatterns: (patterns: HighlightedPattern[]) => void;
}

const WINDOW_OPTIONS = [10, 15, 20, 30, 40, 60];
const LINE_COLORS = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

export default function MatrixProfilePanel({ data, onHighlightPatterns }: Props) {
  const [window, setWindow] = useState(20);
  const [topN, setTopN] = useState(5);

  // 提取收盘价和日期（原始格式用于标注联动）
  const { prices, dates, rawDates } = useMemo(() => {
    const p: number[] = [];
    const d: string[] = [];       // 显示用 M/D
    const rd: string[] = [];      // 原始日期格式（用于走势图联动匹配）
    if (!data.closeColumn || !data.dateColumn) return { prices: p, dates: d, rawDates: rd };
    for (const row of data.rows) {
      const c = parseFloat(row[data.closeColumn!] || '');
      const dateStr = row[data.dateColumn!] || '';
      const parsed = parseDate(dateStr);
      if (!isNaN(c) && c > 0 && parsed) {
        p.push(c);
        d.push(`${parsed.month}/${parsed.day}`);
        rd.push(dateStr.trim());   // 保留原始格式用于匹配
      }
    }
    return { prices: p, dates: d, rawDates: rd };
  }, [data]);

  // Matrix Profile 计算（传入原始日期用于走势图联动）
  const mpResult = useMemo(() => {
    if (prices.length < window * 2) return null;
    return calculateMatrixProfile(prices, dates, window, 500, rawDates);
  }, [prices, dates, window, rawDates]);

  // 相似模式查找
  const similarPatterns = useMemo(() => {
    if (prices.length < window * 2) return [];
    return findSimilarPatterns(prices, dates, window, topN);
  }, [prices, dates, window, topN]);

  // 当前模式走势（归一化到100）
  const currentPattern = useMemo(() => {
    if (prices.length < window) return [];
    const slice = prices.slice(-window);
    const first = slice[0];
    return slice.map(p => (p / first) * 100);
  }, [prices, window]);

  // 当前模式的原始日期范围（用于联动标注）
  const currentDateRange = useMemo(() => {
    if (rawDates.length < window) return null;
    return {
      start: rawDates[rawDates.length - window],
      end: rawDates[rawDates.length - 1],
    };
  }, [rawDates, window]);

  // 相似模式的原始日期范围
  const similarDateRanges = useMemo(() => {
    return similarPatterns.map(sp => {
      const idx = dates.findIndex(d => d === sp.startDate);
      if (idx >= 0 && idx < rawDates.length) {
        const endIdx = Math.min(idx + window - 1, rawDates.length - 1);
        return { start: rawDates[idx], end: rawDates[endIdx] };
      }
      return null;
    });
  }, [similarPatterns, dates, rawDates, window]);

  // 自动标注：当前模式 + 所有 Motif 到价格走势图
  useEffect(() => {
    const patterns: HighlightedPattern[] = [];

    // 1. 标注所有 Motif（最相似模式对）
    if (mpResult?.motifs) {
      mpResult.motifs.forEach((m, i) => {
        patterns.push({
          type: 'similar',
          startDate: m.rawDateA,
          endDate: rawDates[Math.min(m.idxA + window - 1, rawDates.length - 1)] || m.rawDateA,
          label: `Motif${i + 1}: ${m.rawDateA}`,
          color: LINE_COLORS[i % LINE_COLORS.length],
        });
      });
    }

    // 2. 标注当前模式
    if (currentDateRange) {
      patterns.push({
        type: 'current',
        startDate: currentDateRange.start,
        endDate: currentDateRange.end,
        label: `当前${window}天`,
        color: '#a855f7',
      });
    }

    onHighlightPatterns(patterns);
  }, [mpResult, currentDateRange, window, rawDates]);

  // 点击相似模式 -> 在走势图中标注（保留手动标注功能）
  const handleShowInChart = useCallback((index: number) => {
    const sp = similarPatterns[index];
    const range = similarDateRanges[index];
    if (!sp || !range) return;

    const patterns: HighlightedPattern[] = [];
    // 始终显示当前模式
    if (currentDateRange) {
      patterns.push({
        type: 'current',
        startDate: currentDateRange.start,
        endDate: currentDateRange.end,
        label: `当前${window}天`,
        color: '#a855f7',
      });
    }
    // 添加选中的相似模式
    patterns.push({
      type: 'similar',
      startDate: range.start,
      endDate: range.end,
      label: `相似${index + 1}: ${sp.startDate}~${sp.endDate}`,
      color: LINE_COLORS[index % LINE_COLORS.length],
    });

    onHighlightPatterns(patterns);
  }, [similarPatterns, similarDateRanges, currentDateRange, window, onHighlightPatterns]);

  // 为Recharts准备数据
  const chartData = useMemo(() => {
    const data: any[] = [];
    for (let i = 0; i < window; i++) {
      const point: any = { day: i + 1 };
      point['当前模式'] = i < currentPattern.length ? currentPattern[i] : null;
      similarPatterns.forEach((sp, idx) => {
        point[`相似${idx + 1}`] = i < sp.normalizedPattern.length ? sp.normalizedPattern[i] : null;
      });
      data.push(point);
    }
    return data;
  }, [currentPattern, similarPatterns, window]);

  if (prices.length < window * 2) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center text-slate-400 text-sm">
        数据不足，需要至少 {window * 2} 个交易日的数据才能进行相似序列识别
      </div>
    );
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden space-y-px">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-purple-400" />
            <h3 className="text-white font-medium text-sm">相似序列识别</h3>
            <span className="text-slate-500 text-xs">Matrix Profile 算法</span>
          </div>
          <span className="text-slate-400 text-xs">数据量: {prices.length} 天</span>
        </div>
      </div>

      {/* 控制面板 */}
      <div className="px-4 py-3 border-b border-slate-700/50 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">窗口大小:</span>
          <div className="flex gap-1">
            {WINDOW_OPTIONS.map(w => (
              <button
                key={w}
                onClick={() => setWindow(w)}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  window === w
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : 'bg-slate-700/30 text-slate-400 hover:bg-slate-700/50 border border-transparent'
                }`}
              >
                {w}天
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">显示数量:</span>
          <div className="flex gap-1">
            {[3, 5, 10].map(n => (
              <button
                key={n}
                onClick={() => setTopN(n)}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  topN === n
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : 'bg-slate-700/30 text-slate-400 hover:bg-slate-700/50 border border-transparent'
                }`}
              >
                前{n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 当前模式 + 相似模式 走势图 */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-2 mb-2">
          <Search className="w-3.5 h-3.5 text-purple-400" />
          <p className="text-purple-300 text-xs">
            最近 {window} 天走势 vs 历史最相似 {Math.min(topN, similarPatterns.length)} 个片段
          </p>
          {currentDateRange && (
            <span className="text-[10px] text-slate-500 ml-2">
              (当前: {currentDateRange.start} ~ {currentDateRange.end})
            </span>
          )}
        </div>
        <div className="w-full" style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={{ stroke: '#475569' }} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={{ stroke: '#475569' }} tickLine={false} domain={['auto', 'auto']} tickFormatter={(v: number) => v.toFixed(0)} />
              <Tooltip content={<MPTooltip similarPatterns={similarPatterns} />} />
              <Line type="monotone" dataKey="当前模式" stroke="#ffffff" strokeWidth={3} dot={false} />
              {similarPatterns.map((_, i) => (
                <Line key={`相似${i + 1}`} type="monotone" dataKey={`相似${i + 1}`} stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Motif 信息 - 显示完整年月日 */}
      {mpResult && mpResult.motifs.length > 0 && (
        <div className="border-t border-slate-700 px-4 py-3">
          <p className="text-xs text-slate-400 mb-2 flex items-center gap-1.5">
            <GitCompare className="w-3 h-3" /> 最相似模式对（Motif）— 已自动标注在价格走势图中
          </p>
          <div className="space-y-1.5">
            {mpResult.motifs.map((m, i) => (
              <div key={i} className="flex items-center gap-3 text-xs bg-slate-700/20 rounded px-2 py-1.5 flex-wrap">
                <span className="text-slate-500 w-4">#{i + 1}</span>
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: LINE_COLORS[i % LINE_COLORS.length] }} />
                <span className="text-amber-300 font-medium">{m.rawDateA}</span>
                <span className="text-slate-600">↔</span>
                <span className="text-amber-300 font-medium">{m.rawDateB}</span>
                <span className="text-slate-500">距离: {m.distance.toFixed(3)}</span>
                <span className="text-purple-400 font-medium">相似度: {(m.similarity * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Discord 异常点 */}
      {mpResult?.discord && (
        <div className="border-t border-slate-700 px-4 py-3">
          <p className="text-xs text-slate-400 mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-rose-400" /> 异常模式（Discord）
          </p>
          <div className="text-xs bg-rose-500/10 border border-rose-500/20 rounded px-2 py-1.5">
            <span className="text-rose-300">{mpResult.discord.date}</span>
            <span className="text-slate-500 ml-2">距离: {mpResult.discord.distance.toFixed(3)}</span>
            <span className="text-slate-400 ml-2">（与其他所有模式都不相似）</span>
          </div>
        </div>
      )}

      {/* 相似模式详情表 - 带联动按钮 */}
      <div className="border-t border-slate-700 px-4 py-3">
        <p className="text-xs text-slate-400 mb-2">相似片段详情（点击"在走势图中查看"可联动标注）</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
          {similarPatterns.map((sp, i) => (
            <div key={i} className="bg-slate-700/20 rounded-lg p-2.5 border border-slate-700/30 relative group">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: LINE_COLORS[i % LINE_COLORS.length] }} />
                <span className="text-xs font-medium text-slate-300">相似 #{i + 1}</span>
                <span className="text-xs text-purple-400 ml-auto">{(sp.similarity * 100).toFixed(1)}%</span>
              </div>
              <p className="text-[10px] text-slate-500">{sp.startDate} ~ {sp.endDate}</p>
              <p className="text-[10px] text-slate-500">距离: {sp.distance.toFixed(3)}</p>
              <div className="mt-1.5 pt-1.5 border-t border-slate-700/30">
                <p className="text-[10px] text-slate-400">后续5天收益:</p>
                <p className={`text-xs font-bold ${sp.futureReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {sp.futureReturn !== 0 ? fmtPct(sp.futureReturn) : '无数据'}
                </p>
              </div>
              {/* 联动按钮 */}
              <button
                onClick={() => handleShowInChart(i)}
                className="mt-2 w-full flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 transition-colors"
              >
                <Eye className="w-3 h-3" />
                在走势图中查看
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Tooltip */
function MPTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const day = payload[0].payload.day;
  return (
    <div className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 shadow-xl min-w-[160px]">
      <p className="text-slate-400 text-xs mb-1">第{day}天 / 共{payload[0].payload.__TOTAL_DAYS__ || ''}天</p>
      {payload.filter((p: any) => p.value != null).map((p: any, i: number) => {
        const isCurrent = p.dataKey === '当前模式';
        return (
          <div key={p.dataKey} className="flex items-center justify-between gap-4">
            <span className={`text-xs ${isCurrent ? 'text-white font-medium' : 'text-slate-300'}`}>
              {isCurrent ? '● 当前' : `  相似${i}`}
            </span>
            <span className="text-xs text-slate-200">{p.value?.toFixed(2)}</span>
          </div>
        );
      })}
    </div>
  );
}
