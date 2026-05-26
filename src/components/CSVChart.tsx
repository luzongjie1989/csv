import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Brush, ReferenceArea,
} from 'recharts';
import { TrendingUp, Eraser } from 'lucide-react';
import type { ParsedCSV } from '@/types';
import type { HighlightedPattern, ScaleType } from '@/types/chart';

interface CSVChartProps {
  data: ParsedCSV;
  highlightedPatterns?: HighlightedPattern[];
  onClearPatterns?: () => void;
}

export default function CSVChart({ data, highlightedPatterns = [], onClearPatterns }: CSVChartProps) {
  const [scaleType, setScaleType] = useState<ScaleType>('linear');
  // Brush 范围（用于自动适配 Motif 画面）
  const [brushRange, setBrushRange] = useState<{ startIndex?: number; endIndex?: number }>({});

  const rawData = useMemo(() => {
    const { dateColumn, closeColumn, headers, rows } = data;
    const result: any[] = [];

    if (!dateColumn || !closeColumn) return result;

    // 只提取图表需要的列（close + OHLC），不遍历全部header
    const chartColumns = new Set<string>();
    chartColumns.add(closeColumn);
    const headerLower = headers.map(h => h.toLowerCase());
    const ohlcKeys = ['open', 'high', 'low', '开盘', '最高', '最低'];
    headers.forEach(h => {
      if (ohlcKeys.includes(h.toLowerCase())) chartColumns.add(h);
    });

    let firstClose = 0;
    const n = rows.length;
    for (let i = 0; i < n; i++) {
      const row = rows[i];
      const dateValue = row[dateColumn];
      const closeValue = parseFloat(row[closeColumn]?.replace(/,/g, ''));
      if (!dateValue || isNaN(closeValue)) continue;

      if (firstClose === 0) firstClose = closeValue;

      const point: any = { date: dateValue, rawClose: closeValue, idx: i };

      // 根据坐标类型转换收盘价
      if (scaleType === 'linear') {
        point.close = closeValue;
      } else if (scaleType === 'log') {
        point.close = closeValue > 0 ? Math.log(closeValue) : null;
      } else if (scaleType === 'percent') {
        point.close = firstClose > 0 ? ((closeValue / firstClose) - 1) * 100 : 0;
      }

      // 只对图表需要的列做 scale 转换（OHLC）
      chartColumns.forEach((header) => {
        if (header === closeColumn || header === dateColumn) return;
        const val = parseFloat(row[header]?.replace(/,/g, ''));
        if (!isNaN(val)) {
          if (scaleType === 'linear') {
            point[header] = val;
          } else if (scaleType === 'log' && val > 0) {
            point[header] = Math.log(val);
          } else if (scaleType === 'percent' && firstClose > 0) {
            point[header] = ((val / firstClose) - 1) * 100;
          }
        }
      });

      result.push(point);
    }

    return result;
  }, [data, scaleType]);

  const hasOHLC = useMemo(() => {
    const headers = data.headers.map(h => h.toLowerCase());
    return headers.includes('open') || headers.includes('开盘') ||
           headers.includes('high') || headers.includes('最高') ||
           headers.includes('low') || headers.includes('最低');
  }, [data.headers]);

  const numericHeaders = data.headers.filter(h => {
    if (h === data.dateColumn) return false;
    const lower = h.toLowerCase();
    return ['open', 'high', 'low', 'close', '开盘', '最高', '最低', '收盘'].includes(lower);
  });

  const colorPalette = ['#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  // 根据 Motif 数量自动适配画面
  useEffect(() => {
    if (highlightedPatterns.length === 0 || rawData.length === 0) {
      setBrushRange({});
      return;
    }

    // 收集所有标注的日期索引
    const indices: number[] = [];
    highlightedPatterns.forEach(pattern => {
      for (let i = 0; i < rawData.length; i++) {
        if (rawData[i].date === pattern.startDate) indices.push(i);
        if (rawData[i].date === pattern.endDate) indices.push(i);
      }
    });

    if (indices.length === 0) {
      setBrushRange({});
      return;
    }

    // 计算最优显示范围（包含所有 Motif，前后各留 10% 边距）
    const minIdx = Math.min(...indices);
    const maxIdx = Math.max(...indices);
    const padding = Math.max(Math.floor((maxIdx - minIdx) * 0.1), 5);

    const start = Math.max(0, minIdx - padding);
    const end = Math.min(rawData.length - 1, maxIdx + padding);

    setBrushRange({ startIndex: start, endIndex: end });
  }, [highlightedPatterns, rawData]);

  // 匹配高亮模式到数据索引
  const matchedPatterns = useMemo(() => {
    return highlightedPatterns.map((pattern) => {
      let startIdx = -1;
      let endIdx = -1;
      for (let i = 0; i < rawData.length; i++) {
        if (rawData[i].date === pattern.startDate && startIdx === -1) startIdx = i;
        if (rawData[i].date === pattern.endDate) endIdx = i;
      }
      // 如果精确匹配失败，尝试模糊匹配（日期部分匹配）
      if (startIdx === -1 || endIdx === -1) {
        for (let i = 0; i < rawData.length; i++) {
          const d = String(rawData[i].date);
          if (d.includes(pattern.startDate) && startIdx === -1) startIdx = i;
          if (d.includes(pattern.endDate)) endIdx = i;
        }
      }
      return { ...pattern, startIdx, endIdx };
    }).filter(p => p.startIdx >= 0 && p.endIdx >= 0);
  }, [highlightedPatterns, rawData]);

  const handleClear = useCallback(() => {
    onClearPatterns?.();
  }, [onClearPatterns]);

  if (rawData.length === 0) return null;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null;
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl">
        <p className="text-slate-300 text-xs font-medium mb-2">{label}</p>
        {payload.map((entry: any) => (
          <div key={entry.name} className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-slate-400">{entry.name}:</span>
            <span className="text-white font-medium">
              {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // Y轴格式化
  const yTickFormatter = (value: number) => {
    if (scaleType === 'percent') return value.toFixed(0) + '%';
    if (scaleType === 'log') return Math.exp(value).toFixed(0);
    return value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value.toString();
  };

  const yLabel = scaleType === 'percent' ? '涨跌幅(%)' : scaleType === 'log' ? '对数价格' : '价格';

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      {/* Header + 控制按钮 */}
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-cyan-400" />
          <h3 className="text-white font-medium text-sm">价格走势图</h3>
          {matchedPatterns.length > 0 && (
            <span className="text-xs text-purple-400">
              (已标注 {matchedPatterns.length} 个模式)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* 坐标切换 */}
          <div className="flex gap-1">
            {([
              { key: 'linear', label: '原始价格' },
              { key: 'log', label: '对数坐标' },
              { key: 'percent', label: '百分比' },
            ] as { key: ScaleType; label: string }[]).map((s) => (
              <button
                key={s.key}
                onClick={() => setScaleType(s.key)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  scaleType === s.key
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'bg-slate-700/30 text-slate-400 hover:bg-slate-700/50 border border-transparent'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          {/* 清除标注 */}
          {matchedPatterns.length > 0 && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
              title="清除标注"
            >
              <Eraser className="w-3 h-3" />
              清除标注
            </button>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="p-4">
        <ResponsiveContainer width="100%" height={420}>
          <LineChart
            data={rawData}
            margin={{ top: 10, right: 10, left: 10, bottom: 30 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickLine={{ stroke: '#475569' }}
              axisLine={{ stroke: '#475569' }}
              minTickGap={40}
              angle={-30}
              textAnchor="end"
              height={50}
            />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickLine={{ stroke: '#475569' }}
              axisLine={{ stroke: '#475569' }}
              domain={['auto', 'auto']}
              tickFormatter={yTickFormatter}
              label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: -5, style: { fill: '#64748b', fontSize: 10 } }}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* 高亮标注区域 */}
            {matchedPatterns.map((pattern, i) => (
              <ReferenceArea
                key={`${pattern.startDate}-${pattern.endDate}-${i}`}
                x1={rawData[pattern.startIdx]?.date}
                x2={rawData[pattern.endIdx]?.date}
                stroke={pattern.color}
                strokeOpacity={0.8}
                fill={pattern.color}
                fillOpacity={0.15}
                strokeWidth={2}
                strokeDasharray={pattern.type === 'current' ? undefined : '5 3'}
              />
            ))}

            {hasOHLC && numericHeaders.length > 1 ? (
              numericHeaders.map((header, i) => (
                <Line
                  key={header}
                  type="monotone"
                  dataKey={header}
                  stroke={colorPalette[i % colorPalette.length]}
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))
            ) : (
              <Line
                type="monotone"
                dataKey="close"
                stroke="#06b6d4"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, fill: '#06b6d4' }}
              />
            )}

            {/* 缩放Brush - 根据Motif自动适配 */}
            <Brush
              dataKey="date"
              height={30}
              stroke="#475569"
              fill="#1e293b"
              travellerWidth={8}
              startIndex={brushRange.startIndex}
              endIndex={brushRange.endIndex}
              onChange={(range: any) => {
                if (range) {
                  setBrushRange({
                    startIndex: range.startIndex,
                    endIndex: range.endIndex,
                  });
                }
              }}
              tickFormatter={(value: string) => {
                // 显示简短日期
                const parts = value.match(/\d+/g);
                return parts ? `${parts[0]?.slice(-2)}/${parts[1]}` : value;
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 图例 + 标注说明 */}
      <div className="px-4 pb-3 flex flex-wrap gap-3 items-center">
        {hasOHLC && numericHeaders.length > 1 && numericHeaders.map((header, i) => (
          <div key={header} className="flex items-center gap-1.5 text-xs">
            <span className="w-2.5 h-0.5 rounded" style={{ backgroundColor: colorPalette[i % colorPalette.length] }} />
            <span className="text-slate-400">{header}</span>
          </div>
        ))}
        {/* 高亮标注图例 */}
        {matchedPatterns.map((p, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <span className="w-3 h-3 rounded-sm border" style={{ borderColor: p.color, backgroundColor: p.color + '30' }} />
            <span className="text-slate-300">{p.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
